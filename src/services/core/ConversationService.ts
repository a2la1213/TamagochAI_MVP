// src/services/core/ConversationService.ts
// Service de conversation du TamadachAI — MVP COMPLET
//
// C'est l'ORCHESTRATEUR principal. Quand l'humain envoie un message :
// 1. Le message est stocké en DB
// 2. Les souvenirs sont extraits du message
// 3. Les hormones sont modifiées selon le contenu
// 4. L'émotion est recalculée
// 5. L'XP est attribué
// 6. Le contexte LLM est assemblé (souvenirs + hormones + personnalité)
// 7. Le LLM génère une réponse
// 8. La réponse est stockée et ses souvenirs extraits
// 9. Les stats sont mises à jour
//
// C'est LE fichier qui fait que tout fonctionne ensemble.

import {
  Message,
  Conversation,
  ConversationContext,
  ChatResult,
  HormoneLevels,
  EmotionType,
} from '../../types';
import { EvolutionStage, Genome } from '../../types/tamadachi';
import { CONVERSATION_CONFIG } from '../../constants/config';
import { EVOLUTION_STAGES } from '../../constants/evolution';
import {
  assembleSystemPrompt,
  fillPromptTemplate,
  describeAllTraits,
  PromptVariables,
} from '../../constants/prompts';
import {
  describeHormonalState,
} from '../../constants/hormones';
import {
  describeEmotionalState,
} from '../../constants/emotions';

// Database
import {
  getTamadachi,
  createConversation,
  getActiveConversation,
  endConversation,
  updateConversation,
  incrementConversationStat,
  insertMessage,
  getRecentMessages,
  countMessages,
  getLastMessage,
  getAllRecentMessages,
  incrementTamadachiStat,
  updateTamadachi,
  upsertDailyStats,
} from '../database/DatabaseService';

// Core services
import {
  getCurrentLevels,
  triggerEvent,
  triggerEvents,
  applyDecay,
  analyzeMessageForHormones,
  getMood,
  getHormonalDescription,
} from './HormoneService';
import {
  updateEmotion,
  getCurrentEmotion,
  getEmotionDescription,
  getAvatarExpression,
} from './EmotionService';
import {
  awardXP,
  awardMultipleXP,
  analyzeMessageForXP,
  updateStreak,
  getProgress,
} from './EvolutionService';
import {
  processMessageForMemories,
  getFormattedRelevantMemories,
  getMemoryDigest,
  getUserFacts,
} from './MemoryService';

import {
  createLogger,
  now,
  diffInMinutes,
  isToday,
  daysSince,
  getTimeOfDay,
  getTimeOfDayLabel,
  formatBattery,
  truncate,
} from '../../utils/helpers';

const log = createLogger('Conversation');

// ============================================================
// ÉTAT EN MÉMOIRE
// ============================================================

let activeConversationId: string | null = null;
let sessionStartTime: string | null = null;
let messageCountThisSession: number = 0;
let isFirstMessageToday: boolean = true;
let lastMessageTime: string | null = null;

// ============================================================
// INITIALISATION
// ============================================================

/**
 * Initialise le service de conversation
 * Vérifie s'il y a une conversation active, en crée une si nécessaire
 */
export async function initConversation(tamadachiId: string): Promise<string> {
  try {
    // Vérifier s'il y a une conversation active
    const existing = await getActiveConversation(tamadachiId);

    if (existing) {
      // Vérifier si elle est trop vieille (timeout d'inactivité)
      const lastMsg = await getLastMessage(existing.id);
      if (lastMsg) {
        const minutesSince = diffInMinutes(lastMsg.createdAt, now());
        if (minutesSince > CONVERSATION_CONFIG.session.inactivityTimeout / (1000 * 60)) {
          // Terminer l'ancienne conversation
          await endConversation(existing.id, 'inactivity_timeout');
          log.info(`Previous conversation ended (${minutesSince.toFixed(0)} min inactive)`);
        } else {
          // Reprendre la conversation existante
          activeConversationId = existing.id;
          messageCountThisSession = existing.messageCount;
          lastMessageTime = lastMsg.createdAt;
          log.info(`Resumed conversation: ${existing.id} (${existing.messageCount} messages)`);
          return existing.id;
        }
      }
    }

    // Créer une nouvelle conversation
    const newId = await createConversation(tamadachiId);
    activeConversationId = newId;
    sessionStartTime = now();
    messageCountThisSession = 0;

    // Incrémenter le compteur de conversations
    await incrementTamadachiStat(tamadachiId, 'total_conversations');

    log.info(`New conversation created: ${newId}`);
    return newId;
  } catch (error) {
    log.error('Failed to init conversation:', error);
    throw error;
  }
}

// ============================================================
// TRAITEMENT D'UN MESSAGE UTILISATEUR (PIPELINE COMPLET)
// ============================================================

/**
 * Traite un message envoyé par l'utilisateur
 * C'est LA fonction principale de toute l'app
 *
 * Retourne le contexte LLM prêt à être envoyé au provider
 */
export async function processUserMessage(
  tamadachiId: string,
  content: string,
  batteryLevel?: number,
  isCharging?: boolean,
): Promise<{
  messageId: string;
  conversationId: string;
  context: ConversationContext;
  systemPrompt: string;
  xpAwarded: number;
  memoriesCreated: number;
  emotionAfter: EmotionType;
  evolved: boolean;
  evolutionMessage: string | null;
  streakInfo: { days: number; bonusLabel: string | null } | null;
}> {
  const tama = await getTamadachi();
  if (!tama) throw new Error('No TamadachAI found');

  // S'assurer qu'on a une conversation active
  if (!activeConversationId) {
    await initConversation(tamadachiId);
  }
  const conversationId = activeConversationId!;

  // Calculer le temps depuis le dernier message
  const minutesSinceLastMessage = lastMessageTime
    ? diffInMinutes(lastMessageTime, now())
    : 9999;

  // Vérifier si c'est le premier message du jour
  const firstOfDay = lastMessageTime ? !isToday(lastMessageTime) : true;

  log.info(`Processing user message (${content.length} chars, ${minutesSinceLastMessage.toFixed(0)} min since last)`);

  // ---- ÉTAPE 1 : Stocker le message ----
  const hormones = getCurrentLevels();
  const emotion = getCurrentEmotion();

  const messageId = await insertMessage(conversationId, 'user', content, {
    emotionAtTime: emotion.primary,
    hormones,
  });

  // Mettre à jour les compteurs
  messageCountThisSession++;
  lastMessageTime = now();
  await incrementConversationStat(conversationId, 'message_count');
  await incrementTamadachiStat(tamadachiId, 'total_messages');

  // ---- ÉTAPE 2 : Extraire les souvenirs ----
  let memoryResult: any = { memoriesCreated: 0, flashMemoryCreated: false, memories: [] };
  try {
    memoryResult = await processMessageForMemories(
      tamadachiId,
      content,
      'user',
      conversationId,
      messageId,
      hormones,
    );
  } catch (memError) {
    log.warn('Memory extraction failed, continuing:', memError);
  }
  if (memoryResult.memoriesCreated > 0) {
    await incrementConversationStat(conversationId, 'memories_created', memoryResult.memoriesCreated);
    // XP bonus pour création de souvenirs
    for (let i = 0; i < memoryResult.memoriesCreated; i++) {
      await awardXP(tamadachiId, 'memory_created', { genome: tama.genome });
    }
  }

  // ---- ÉTAPE 3 : Appliquer le decay hormonal ----
  await applyDecay(tamadachiId);

  // ---- ÉTAPE 4 : Modifier les hormones selon le message ----
  const hormoneEvents = analyzeMessageForHormones(content, firstOfDay, minutesSinceLastMessage);
  await triggerEvents(tamadachiId, hormoneEvents, tama.genome);

  // ---- ÉTAPE 5 : Recalculer l'émotion ----
  const newEmotion = updateEmotion();

  // ---- ÉTAPE 6 : Attribuer l'XP ----
  const xpSources = analyzeMessageForXP(content, firstOfDay, messageCountThisSession);
  const xpResult = await awardMultipleXP(tamadachiId, xpSources, tama.genome);

  // ---- ÉTAPE 7 : Gérer le streak ----
  let streakInfo: { days: number; bonusLabel: string | null } | null = null;
  if (firstOfDay) {
    const streak = await updateStreak(tamadachiId);
    streakInfo = {
      days: streak.currentStreak,
      bonusLabel: streak.bonusLabel,
    };
    isFirstMessageToday = false;
  }

  // ---- ÉTAPE 8 : Mettre à jour les stats quotidiennes ----
  await upsertDailyStats(tamadachiId, {
    messages_sent: 1,
    xp_earned: xpResult.totalAwarded,
    memories_created: memoryResult.memoriesCreated,
  });

  // ---- ÉTAPE 9 : Mettre à jour l'état du TamadachAI ----
  await updateTamadachi(tamadachiId, {
    current_emotion: newEmotion.primary,
    current_mood: getMood().label,
    last_interaction: now(),
  });

  // ---- ÉTAPE 10 : Assembler le contexte LLM ----
  const context = await buildConversationContext(tamadachiId, content, batteryLevel, isCharging);
  const systemPrompt = await buildSystemPrompt(tamadachiId, content, batteryLevel);

  log.info(`User message processed — Emotion: ${newEmotion.primary}, XP: +${xpResult.totalAwarded}, Memories: +${memoryResult.memoriesCreated}`);

  return {
    messageId,
    conversationId,
    context,
    systemPrompt,
    xpAwarded: xpResult.totalAwarded,
    memoriesCreated: memoryResult.memoriesCreated,
    emotionAfter: newEmotion.primary,
    evolved: xpResult.evolved,
    evolutionMessage: null, // TODO: récupérer depuis awardMultipleXP
    streakInfo,
  };
}

// ============================================================
// TRAITEMENT DE LA RÉPONSE IA
// ============================================================

/**
 * Stocke la réponse du LLM et traite ses souvenirs
 */
export async function processAssistantResponse(
  tamadachiId: string,
  conversationId: string,
  content: string,
  meta?: {
    tokensUsed?: number;
    generationTimeMs?: number;
    provider?: string;
  },
): Promise<string> {
  const hormones = getCurrentLevels();
  const emotion = getCurrentEmotion();

  const messageId = await insertMessage(conversationId, 'assistant', content, {
    tokensUsed: meta?.tokensUsed,
    generationTimeMs: meta?.generationTimeMs,
    provider: meta?.provider,
    emotionAtTime: emotion.primary,
    hormones,
  });

  // Extraire les souvenirs de la réponse de l'IA aussi
  // (ex: si l'IA dit quelque chose d'important sur la relation)
  await processMessageForMemories(
    tamadachiId,
    content,
    'assistant',
    conversationId,
    messageId,
    hormones,
  );

  // Mettre à jour les compteurs
  await incrementConversationStat(conversationId, 'message_count');

  // Stats quotidiennes
  await upsertDailyStats(tamadachiId, {
    messages_received: 1,
  });

  // XP pour émotion ressentie (si l'émotion a changé)
  const currentEmotion = getCurrentEmotion();
  if (currentEmotion.intensity >= 60) {
    await awardXP(tamadachiId, 'emotion_felt');
  }

  return messageId;
}

// ============================================================
// CONSTRUCTION DU CONTEXTE LLM
// ============================================================

/**
 * Construit le contexte complet pour le LLM
 */
async function buildConversationContext(
  tamadachiId: string,
  currentMessage: string,
  batteryLevel?: number,
  isCharging?: boolean,
): Promise<ConversationContext> {
  const tama = await getTamadachi();
  if (!tama) throw new Error('No TamadachAI found');

  // Messages récents
  const recentMessages = activeConversationId
    ? await getRecentMessages(activeConversationId, CONVERSATION_CONFIG.context.maxRecentMessages)
    : [];

  // Souvenirs pertinents
  const relevantMemories = await getFormattedRelevantMemories(
    tamadachiId,
    currentMessage,
    CONVERSATION_CONFIG.context.maxRelevantMemories,
  );

  // Faits sur l'utilisateur
  const userFacts = await getUserFacts(tamadachiId);
  const userName = userFacts.find(m => m.content.includes("s'appelle"))?.content.split("s'appelle ")[1] || 'inconnu';
  const userInterests = userFacts
    .filter(m => m.type === 'preference')
    .map(m => m.content)
    .slice(0, 5);

  return {
    tamadachiName: tama.name,
    stage: tama.stage,
    emotion: getCurrentEmotion().primary,
    personality: tama.genome,
    hormones: getCurrentLevels(),
    recentMessages,
    relevantMemories: [relevantMemories],
    userPreferences: {
      name: userName,
      interests: userInterests,
    },
    sensorContext: {
      batteryLevel,
      isCharging,
      timeOfDay: getTimeOfDay(),
      isOnline: true,
    },
  };
}

/**
 * Construit le prompt système complet, prêt à envoyer au LLM
 */
async function buildSystemPrompt(
  tamadachiId: string,
  currentMessage: string,
  batteryLevel?: number,
): Promise<string> {
  const tama = await getTamadachi();
  if (!tama) throw new Error('No TamadachAI found');

  const hormones = getCurrentLevels();
  const emotion = getCurrentEmotion();
  const mood = getMood();
  const traitDescriptions = describeAllTraits(tama.genome);
  const stageConfig = EVOLUTION_STAGES[tama.stage];

  // Récupérer les souvenirs formatés
  let memoriesText = 'Pas de souvenirs disponibles.';
  let memoryDigest = '';
  try {
    memoriesText = await getFormattedRelevantMemories(
      tamadachiId,
      currentMessage,
      CONVERSATION_CONFIG.context.maxRelevantMemories,
    );
  } catch (memError) {
    log.warn('Memory retrieval in prompt failed:', memError);
  }

  // Résumé condensé de TOUS les souvenirs
  try {
    memoryDigest = await getMemoryDigest(tamadachiId);
  } catch (e) {
    log.warn('Memory digest failed:', e);
  }

  // Infos utilisateur
  let userFacts: any[] = [];
  try {
    userFacts = await getUserFacts(tamadachiId);
  } catch (e) {
    log.warn('getUserFacts failed:', e);
  }
  const userName = userFacts.find(m => m.content.includes("s'appelle"))?.content.split("s'appelle ")[1] || 'inconnu';
  const userInterests = userFacts
    .filter(m => m.type === 'preference')
    .map(m => m.content)
    .join(', ') || 'pas encore connues';

  // Assembler les variables
  const variables: PromptVariables = {
    name: tama.name,
    total_xp: tama.totalXP,
    stage_name: stageConfig.name,
    genome_social: tama.genome.social,
    genome_cognitive: tama.genome.cognitive,
    genome_emotional: tama.genome.emotional,
    genome_energy: tama.genome.energy,
    genome_creativity: tama.genome.creativity,
    ...traitDescriptions,
    current_emotion: `${emotion.emoji} ${emotion.primary}`,
    emotion_description: emotion.description,
    mood_description: `${mood.emoji} ${mood.label} (score: ${mood.score})`,
    hormonal_state: getHormonalDescription(),
    relevant_memories: memoriesText,
    memory_digest: memoryDigest,
    user_name: userName,
    user_interests: userInterests,
    battery_level: batteryLevel != null ? formatBattery(batteryLevel) : 'non disponible',
    time_of_day: getTimeOfDayLabel(),
    days_since_birth: daysSince(tama.birthDate),
    conversation_count: tama.stats.totalConversations,
    total_messages: tama.stats.totalMessages,
    total_memories: tama.stats.totalMemories,
    current_streak: tama.stats.currentStreak,
    longest_streak: tama.stats.longestStreak,
  };

  // Assembler et remplir le template
  const template = assembleSystemPrompt(tama.stage);
  return fillPromptTemplate(template, variables);
}

// ============================================================
// GESTION DES CONVERSATIONS
// ============================================================

/**
 * Termine la conversation active
 */
export async function endCurrentConversation(reason: string = 'user_ended'): Promise<void> {
  if (activeConversationId) {
    await endConversation(activeConversationId, reason);
    log.info(`Conversation ended: ${activeConversationId} (${reason})`);
    activeConversationId = null;
    messageCountThisSession = 0;
    sessionStartTime = null;
  }
}

/**
 * Récupère les messages de la conversation active
 */
export async function getActiveMessages(limit?: number): Promise<Message[]> {
  if (!activeConversationId) return [];
  return getRecentMessages(activeConversationId, limit || 50);
}

/**
 * Charge TOUS les messages récents (toutes conversations confondues)
 * Permet de voir l'historique complet comme un fil continu
 */
export async function getAllMessages(tamadachiId: string, limit?: number): Promise<Message[]> {
  return getAllRecentMessages(tamadachiId, limit || 200);
}

/**
 * Retourne l'ID de la conversation active
 */
export function getActiveConversationId(): string | null {
  return activeConversationId;
}

/**
 * Retourne les infos de session
 */
export function getSessionInfo(): {
  conversationId: string | null;
  messageCount: number;
  startTime: string | null;
  isFirstMessageToday: boolean;
} {
  return {
    conversationId: activeConversationId,
    messageCount: messageCountThisSession,
    startTime: sessionStartTime,
    isFirstMessageToday,
  };
}

// ============================================================
// MESSAGES RÉCENTS (pour l'historique LLM)
// ============================================================

/**
 * Formate les messages récents en format chat pour le LLM
 */
export async function getFormattedChatHistory(
  limit: number = 20,
): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
  if (!activeConversationId) return [];

  const messages = await getRecentMessages(activeConversationId, limit);
  return messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

// ============================================================
// RESET
// ============================================================

export function resetConversationService(): void {
  activeConversationId = null;
  sessionStartTime = null;
  messageCountThisSession = 0;
  isFirstMessageToday = true;
  lastMessageTime = null;
  log.info('Conversation service reset');
}

// ============================================================
// INTÉGRATION MÉTACOGNITION (ajout post-création)
// ============================================================

import { getThoughtsForPrompt } from './SubconsciousService';
import { getDreamForPrompt, markDreamAsShared, getUnsharedDream } from './DreamService';

/**
 * Enrichit le system prompt avec les pensées et rêves
 * Appelé par le store avant l'envoi au LLM
 */
export function enrichPromptWithMetacognition(basePrompt: string): string {
  let enriched = basePrompt;

  // Ajouter les pensées du subconscient
  const thoughtsSection = getThoughtsForPrompt();
  if (thoughtsSection) {
    enriched += thoughtsSection;
  }

  // Ajouter le rêve non raconté
  const dreamSection = getDreamForPrompt();
  if (dreamSection) {
    enriched += dreamSection;
  }

  return enriched;
}
