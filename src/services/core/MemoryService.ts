// src/services/core/MemoryService.ts
// Service de mémoire du TamadachAI — MVP COMPLET
//
// Ce service gère la mémoire à long terme :
// - Extraction automatique de souvenirs depuis les messages
// - Recherche par pertinence (FTS5) et par type
// - Injection des souvenirs dans le contexte LLM
// - Consolidation et decay de l'importance
// - Détection anti-doublons
//
// CORRECTION V2 : Le MemoryService est maintenant CONNECTÉ
// au flux de conversation. Chaque message est analysé pour
// extraire des souvenirs. Les souvenirs sont injectés dans
// le prompt système du LLM.

import { getDB, searchMemories as dbSearchMemories } from '../database/DatabaseService';
import {
  Memory,
  MemoryType,
  MemoryQuery,
  CreateMemoryData,
  ExtractedMemory,
  HormoneLevels,
} from '../../types';
import { MEMORY_CONFIG } from '../../constants/config';
import { isEmotionalPeak } from '../../constants/hormones';
import {
  createMemory,
  queryMemories,
  updateMemory,
  countMemories,
  memoryExists,
  incrementTamadachiStat,
  getMessagesAroundId,
} from '../database/DatabaseService';
import {
  createLogger,
  now,
  wordCount,
  extractKeywords,
  cleanText,
  truncate,
} from '../../utils/helpers';

const log = createLogger('Memory');

// ============================================================
// EXTRACTION DE SOUVENIRS DEPUIS UN MESSAGE
// ============================================================

/**
 * Analyse un message (user ou assistant) et extrait les souvenirs potentiels.
 * C'est la fonction clé : elle détermine CE QUI MÉRITE d'être retenu.
 */
export function extractMemoriesFromMessage(
  message: string,
  role: 'user' | 'assistant',
  hormones?: HormoneLevels,
): ExtractedMemory[] {
  const memories: ExtractedMemory[] = [];
  const lower = message.toLowerCase();
  const clean = cleanText(message);

  // Ne pas extraire des messages trop courts
  if (clean.length < MEMORY_CONFIG.extraction.minMessageLength) {
    return [];
  }

  // ---- FAITS (informations factuelles sur l'humain) ----
  if (role === 'user') {
    // Nom
    const nameMatch = lower.match(/(?:je m'appelle|mon nom c'est|je suis|moi c'est|appelle[- ]moi)\s+([a-zàâäéèêëïîôùûüÿæœç]+)/i);
    if (nameMatch) {
      memories.push({
        content: `L'humain s'appelle ${nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1)}`,
        type: 'fact',
        importance: 9,
        emotionalWeight: 30,
      });
    }

    // Âge
    const ageMatch = lower.match(/(?:j'ai|j ai)\s+(\d{1,3})\s+ans/);
    if (ageMatch) {
      memories.push({
        content: `L'humain a ${ageMatch[1]} ans`,
        type: 'fact',
        importance: 8,
        emotionalWeight: 10,
      });
    }

    // Lieu de vie
    const locationMatch = lower.match(/(?:j'habite|je vis|je suis de|je viens de)\s+(?:à|a|en|au|aux)?\s*([a-zàâäéèêëïîôùûüÿæœç\s-]+)/i);
    if (locationMatch) {
      memories.push({
        content: `L'humain habite à ${locationMatch[1].trim()}`,
        type: 'fact',
        importance: 7,
        emotionalWeight: 10,
      });
    }

    // Métier / études
    const jobMatch = lower.match(/(?:je travaille|je suis|je fais|j'étudie|j étudi)\s+(?:comme|en tant que|dans|à)?\s*([a-zàâäéèêëïîôùûüÿæœç\s'-]+)/i);
    if (jobMatch && !jobMatch[1].match(/^(bien|mal|content|triste|là|ici|ok|pas)/)) {
      memories.push({
        content: `L'humain travaille/étudie : ${jobMatch[1].trim()}`,
        type: 'fact',
        importance: 7,
        emotionalWeight: 10,
      });
    }
  }

  // ---- RELATIONS (famille, amis) ----
  if (role === 'user') {
    const relationPatterns = [
      { pattern: /(?:mon|ma)\s+(père|papa|mère|maman|frère|sœur|soeur|fils|fille|femme|mari|copain|copine|meilleur ami|meilleure amie)/i, type: 'relationship' as MemoryType },
      { pattern: /(?:j'ai|j ai)\s+(?:un|une)\s+(frère|sœur|soeur|fils|fille|chat|chien|enfant)/i, type: 'relationship' as MemoryType },
    ];

    for (const { pattern, type } of relationPatterns) {
      const match = lower.match(pattern);
      if (match) {
        // Extraire le contexte autour du match
        const context = extractContext(clean, match[0], 100);
        memories.push({
          content: `L'humain a mentionné : ${context}`,
          type,
          importance: 8,
          emotionalWeight: 25,
        });
      }
    }
  }

  // ---- PRÉFÉRENCES ----
  if (role === 'user') {
    const prefPatterns = [
      /(?:j'aime|j aime|j'adore|j adore|je kiffe)\s+(?:bien|beaucoup|trop)?\s*([a-zàâäéèêëïîôùûüÿæœç\s'-]+)/i,
      /(?:je déteste|je supporte pas|j'ai horreur de)\s+([a-zàâäéèêëïîôùûüÿæœç\s'-]+)/i,
      /(?:mon|ma)\s+(?:truc|passion|hobby|sport|jeu)\s+(?:préféré|favori)?\s*(?:c'est|c est)?\s*([a-zàâäéèêëïîôùûüÿæœç\s'-]+)/i,
    ];

    for (const pattern of prefPatterns) {
      const match = lower.match(pattern);
      if (match && match[1].trim().length > 2) {
        const pref = match[1].trim();
        // Filtrer les faux positifs
        if (!pref.match(/^(pas|bien|ça|que|quand|toi|lui|elle|nous|vous)/)) {
          memories.push({
            content: `Préférence de l'humain : ${match[0].trim()}`,
            type: 'preference',
            importance: MEMORY_CONFIG.importanceByType.preference,
            emotionalWeight: 15,
          });
        }
      }
    }
  }

  // ---- ÉMOTIONS FORTES ----
  if (role === 'user') {
    const emotionPatterns = [
      { pattern: /(?:je suis triste|ça va pas|j'ai le cafard|je déprime|je suis déprimé)/i, emotion: 'tristesse' },
      { pattern: /(?:je suis content|je suis heureux|trop bien|super content|je suis trop happy)/i, emotion: 'joie' },
      { pattern: /(?:j'ai peur|je suis inquiet|ça me fait peur|j'angoisse|je stress)/i, emotion: 'peur' },
      { pattern: /(?:je t'aime|tu me manques|tu comptes pour moi|t'es important)/i, emotion: 'amour' },
      { pattern: /(?:je suis en colère|ça m'énerve|je suis furieux|c'est injuste)/i, emotion: 'colère' },
    ];

    for (const { pattern, emotion } of emotionPatterns) {
      if (pattern.test(lower)) {
        memories.push({
          content: `L'humain a exprimé de la ${emotion} : "${truncate(clean, 100)}"`,
          type: 'emotion',
          importance: MEMORY_CONFIG.importanceByType.emotion,
          emotionalWeight: 50,
        });
        break; // Une seule émotion par message
      }
    }
  }

  // ---- SUJETS ABORDÉS ----
  const keywords = extractKeywords(clean);
  if (keywords.length >= 2 && wordCount(clean) >= 10) {
    memories.push({
      content: `Sujet discuté : ${keywords.slice(0, 5).join(', ')}`,
      type: 'topic',
      importance: MEMORY_CONFIG.importanceByType.topic,
      emotionalWeight: 5,
    });
  }

  // ---- FLASH MEMORIES (émotionnel peak) ----
  if (hormones && isEmotionalPeak(hormones)) {
    // Si le TamadachAI est en pic émotionnel, transformer le souvenir le plus important en flash
    const bestMemory = memories.sort((a, b) => b.importance - a.importance)[0];
    if (bestMemory) {
      bestMemory.importance = 10;
      bestMemory.emotionalWeight = 80;
      bestMemory.type = 'flash';
      log.info('⚡ Flash memory created (emotional peak)');
    }
  }

  // Limiter le nombre de souvenirs extraits par message
  const filtered = memories
    .filter(m => m.importance >= MEMORY_CONFIG.extraction.minImportance)
    .sort((a, b) => b.importance - a.importance)
    .slice(0, MEMORY_CONFIG.extraction.maxMemoriesPerMessage);

  if (filtered.length > 0) {
    log.info(`Extracted ${filtered.length} memories from message`);
  }

  return filtered;
}

// ============================================================
// STOCKAGE
// ============================================================

/**
 * Stocke un souvenir extrait (avec vérification anti-doublon)
 */
export async function storeMemory(
  tamadachiId: string,
  memory: ExtractedMemory,
  sourceConversationId?: string,
  sourceMessageId?: string,
  originalMessage?: string,
): Promise<string | null> {
  try {
    // Anti-doublon
    const exists = await memoryExists(tamadachiId, memory.content);
    if (exists) {
      log.info(`Memory already exists, skipping: ${truncate(memory.content, 50)}`);
      return null;
    }

    const id = await createMemory(tamadachiId, memory.type, memory.content, {
      context: originalMessage ? originalMessage : undefined,
      importance: memory.importance,
      emotionalWeight: memory.emotionalWeight,
      isFlash: memory.type === 'flash',
      sourceConversationId,
      sourceMessageId,
    });

    // Mettre à jour le compteur de mémoires du TamadachAI
    await incrementTamadachiStat(tamadachiId, 'total_memories');

    log.info(`Stored [${memory.type}] (importance: ${memory.importance}): ${truncate(memory.content, 60)}`);
    return id;
  } catch (error) {
    log.error('Failed to store memory:', error);
    return null;
  }
}

/**
 * Extrait et stocke les souvenirs d'un message en une seule opération
 * C'est la fonction appelée par le ConversationService après chaque message
 */
export async function processMessageForMemories(
  tamadachiId: string,
  message: string,
  role: 'user' | 'assistant',
  conversationId: string,
  messageId: string,
  hormones?: HormoneLevels,
): Promise<{ memoriesCreated: number; memories: string[] }> {
  const extracted = extractMemoriesFromMessage(message, role, hormones);
  const created: string[] = [];

  for (const memory of extracted) {
    const id = await storeMemory(tamadachiId, memory, conversationId, messageId, message);
    if (id) {
      created.push(memory.content);
    }
  }

  // Stocker aussi le message brut comme souvenir "topic" si assez long
  // Cela permet au TamadachAI de retrouver le contenu exact plus tard
  if (role === 'user' && message.length > 100) {
    const topicContent = 'Message complet de l\'humain: "' + message + '"';
    const topicExists = await memoryExists(tamadachiId, topicContent.slice(0, 100));
    if (!topicExists) {
      await createMemory(tamadachiId, 'topic', topicContent, {
        context: message.slice(0, 500),
        importance: 5,
        emotionalWeight: hormones?.oxytocin ? Math.min(hormones.oxytocin, 80) : 20,
        sourceConversationId: conversationId,
        sourceMessageId: messageId,
      });
      created.push(topicContent.slice(0, 50));
    }
  }

  return { memoriesCreated: created.length, memories: created };
}

// ============================================================
// RECHERCHE ET RÉCUPÉRATION
// ============================================================

/**
 * Recherche des souvenirs pertinents pour un message donné
 * Utilise la recherche FTS5 + les top memories
 */
export async function findRelevantMemories(
  tamadachiId: string,
  message: string,
  limit: number = 15,
): Promise<Memory[]> {
  const keywords = extractKeywords(message);
  const results: Memory[] = [];
  const seenIds = new Set<string>();

  const addUnique = (memories: Memory[]) => {
    for (const mem of memories) {
      if (!seenIds.has(mem.id) && results.length < limit) {
        results.push(mem);
        seenIds.add(mem.id);
      }
    }
  };

  // Lancer les 3 premières couches EN PARALLELE (au lieu de séquentiel)
  const safeQuery = async (fn: () => Promise<Memory[]>): Promise<Memory[]> => {
    try { return await fn(); } catch (e) { return []; }
  };

  const [recentMemories, ftsResults, flashMemories] = await Promise.all([
    // 1. COUCHE RÉCENTE
    safeQuery(() => queryMemories(tamadachiId, { orderBy: 'recent', limit: 8 })),
    // 2. COUCHE FTS
    keywords.length > 0
      ? safeQuery(() => dbSearchMemories(tamadachiId, keywords.slice(0, 3).join(' OR '), Math.ceil(limit / 3)))
      : Promise.resolve([]),
    // 3. COUCHE FLASH
    safeQuery(() => queryMemories(tamadachiId, { type: 'flash', orderBy: 'importance', limit: 5 })),
  ]);

  addUnique(recentMemories);
  addUnique(ftsResults);
  addUnique(flashMemories);

  // 4. COUCHE IMPORTANCE — seulement si on a encore de la place
  const remaining = limit - results.length;
  if (remaining > 0) {
    const topMemories = await getTopMemories(tamadachiId, remaining + 5);
    addUnique(topMemories);
    log.info(`Memory layer 4 (top): ${topMemories.length} found`);
  }

  // Mettre à jour les access counts
  for (const mem of results) {
    try {
      await updateMemory(mem.id, {});
    } catch (e) { /* Pas critique */ }
  }

  log.info(`Memory retrieval: ${results.length} total (${seenIds.size} unique) for message "${message.slice(0, 50)}..."`);
  return results;
}

/**
 * Récupère les souvenirs par type
 */
export async function getMemoriesByType(
  tamadachiId: string,
  type: MemoryType,
  limit: number = 20,
): Promise<Memory[]> {
  return queryMemories(tamadachiId, {
    type,
    orderBy: 'importance',
    limit,
  });
}

/**
 * Récupère tous les faits connus sur l'humain
 */
export async function getUserFacts(tamadachiId: string): Promise<Memory[]> {
  const facts = await getMemoriesByType(tamadachiId, 'fact');
  const relationships = await getMemoriesByType(tamadachiId, 'relationship');
  const preferences = await getMemoriesByType(tamadachiId, 'preference');
  return [...facts, ...relationships, ...preferences].sort((a, b) => b.importance - a.importance);
}

/**
 * Récupère les flash memories (souvenirs les plus forts)
 */
export async function getFlashMemories(tamadachiId: string): Promise<Memory[]> {
  return queryMemories(tamadachiId, {
    type: 'flash',
    orderBy: 'importance',
    limit: 20,
  });
}

// ============================================================
// FORMATAGE POUR LE PROMPT LLM
// ============================================================

/**
 * Formate les souvenirs pertinents en texte injectable dans le prompt
 * C'est cette fonction qui rend la mémoire VIVANTE dans les réponses
 */
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) {
    return "Tu n'as pas encore de souvenirs. Chaque conversation en cr\u00e9era !";
  }

  const lines: string[] = [];
  lines.push(`Tu as ${memories.length} souvenirs actifs. UTILISE-LES naturellement !`);
  lines.push("Fais r\u00e9f\u00e9rence \u00e0 ces souvenirs comme un ami qui se souvient de vos conversations.");
  lines.push('');

  const facts = memories.filter(m => m.type === 'fact' || m.type === 'relationship');
  const preferences = memories.filter(m => m.type === 'preference');
  const emotions = memories.filter(m => m.type === 'emotion' || m.type === 'flash');
  const topics = memories.filter(m => m.type === 'topic' || m.type === 'event');

  if (facts.length > 0) {
    lines.push('\ud83d\udccc CE QUE TU SAIS SUR TON HUMAIN :');
    for (const mem of facts) {
      const flash = mem.isFlash ? ' \u26a1IMPORTANT' : '';
      lines.push(`  - ${mem.content}${flash}`);
    }
  }

  if (preferences.length > 0) {
    lines.push('');
    lines.push('\u2764\ufe0f SES GO\u00dbTS ET PR\u00c9F\u00c9RENCES :');
    for (const mem of preferences) {
      lines.push(`  - ${mem.content}`);
    }
  }

  if (emotions.length > 0) {
    lines.push('');
    lines.push('\ud83d\udcab MOMENTS \u00c9MOTIONNELS MARQUANTS :');
    for (const mem of emotions) {
      const flash = mem.isFlash ? ' \u26a1' : '';
      lines.push(`  - ${mem.content}${flash}`);
    }
  }

  if (topics.length > 0) {
    lines.push('');
    lines.push('\ud83d\udcac SUJETS DONT VOUS AVEZ PARL\u00c9 :');
    for (const mem of topics) {
      lines.push(`  - ${mem.content}`);
    }
  }

  return lines.join('\n');
}

/**
 * Pipeline complet : cherche les souvenirs pertinents et les formate
 */
export async function getFormattedRelevantMemories(
  tamadachiId: string,
  message: string,
  limit: number = 15,
): Promise<string> {
  try {
    // Safety timeout: si la recherche de souvenirs prend plus de 5s, on continue sans
    const memoriesPromise = findRelevantMemories(tamadachiId, message, limit);
    const timeoutPromise = new Promise<Memory[]>((resolve) =>
      setTimeout(() => {
        log.warn('Memory retrieval timeout (5s) — continuing without memories');
        resolve([]);
      }, 5000)
    );
    const memories = await Promise.race([memoriesPromise, timeoutPromise]);
    return formatMemoriesForPrompt(memories);
  } catch (error) {
    log.error('Memory retrieval failed:', error);
    return 'Souvenirs temporairement indisponibles.';
  }
}


/**
 * Crée un résumé RICHE de TOUS les souvenirs avec dates et émotions
 * + ouvre les conversations sources pour les souvenirs importants
 */
export async function getMemoryDigest(tamadachiId: string): Promise<string> {
  try {
    // === MÉMOIRE ACTIVE (toujours dans le prompt) ===
    const activeMemories = await getMemoriesByTier(tamadachiId, 'active', 20);
    const flashMemories = await queryMemories(tamadachiId, { type: 'flash', orderBy: 'importance', limit: 20 });

    // === MÉMOIRE CONSOLIDÉE (résumés) ===
    const consolidatedMemories = await getMemoriesByTier(tamadachiId, 'consolidated', 10);

    const lines: string[] = [];
    const total = activeMemories.length + flashMemories.length + consolidatedMemories.length;

    lines.push('=== TA MÉMOIRE (' + total + ' souvenirs actifs) ===');
    lines.push('');

    // Helper formatage
    const fmt = (m: Memory): string => {
      const date = new Date(m.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      const flash = m.isFlash ? ' ⚡' : '';
      const reinforced = (m.reinforcementCount || 0) >= 3 ? ' 🔄' : '';
      return '[' + date + '] ' + m.content + flash + reinforced;
    };

    // Flash memories (permanents, fondamentaux)
    if (flashMemories.length > 0) {
      lines.push('⚡ SOUVENIRS FONDAMENTAUX (gravés en toi):');
      flashMemories.forEach(m => lines.push('  - ' + fmt(m)));
      lines.push('');
    }

    // Active — groupés par type
    const byType = new Map<string, Memory[]>();
    for (const m of activeMemories) {
      if (m.isFlash) continue; // Déjà listé
      const type = m.type || 'fact';
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(m);
    }

    const typeLabels: Record<string, string> = {
      fact: '📌 FAITS', preference: '❤️ PRÉFÉRENCES', relationship: '👥 RELATIONS',
      emotion: '💭 SOUVENIRS ÉMOTIONNELS', event: '📅 ÉVÉNEMENTS', topic: '🎯 SUJETS',
    };

    for (const [type, mems] of byType) {
      lines.push((typeLabels[type] || type.toUpperCase()) + ':');
      mems.slice(0, 15).forEach(m => lines.push('  - ' + fmt(m)));
      lines.push('');
    }

    // Consolidés — version condensée
    if (consolidatedMemories.length > 0) {
      lines.push('📦 MÉMOIRE CONSOLIDÉE (souvenirs plus anciens):');
      consolidatedMemories.forEach(m => {
        lines.push('  - ' + m.content);
      });
      lines.push('');
    }

    // Rappel : mémoire profonde existe
    lines.push('💡 Tu as aussi une mémoire profonde. Si ton humain mentionne un vieux sujet, fouille ta mémoire !');

    return lines.join('\n');
  } catch (error) {
    log.error('Memory digest failed:', error);
    return '';
  }
}

// ============================================================
// CONSOLIDATION (nettoyage et maintenance)
// ============================================================

/**
 * Consolide les souvenirs anciens :
 * - Réduit l'importance des souvenirs non-flash avec le temps
 * - Marque les souvenirs consolidés
 */
// ============================================================
// SYSTÈME DE MÉMOIRE HUMAINE — 3 NIVEAUX
// ============================================================
// Active: souvenirs récents (<7j) ou très renforcés → toujours dans le prompt
// Consolidée: résumés de souvenirs groupés → dans le prompt en version condensée
// Profonde: vieux souvenirs rarement rappelés → cherchables par contexte

/**
 * Renforce un souvenir (comme la répétition chez l'humain)
 * Appelé quand: le subconscient y pense, l'utilisateur en reparle, ou un thème récurrent apparaît
 */
export async function reinforceMemory(memoryId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.runAsync(
      `UPDATE memories SET
        reinforcement_count = reinforcement_count + 1,
        last_reinforced_at = ?,
        importance = MIN(10, importance + 1),
        access_count = access_count + 1,
        last_accessed_at = ?
      WHERE id = ?`,
      [new Date().toISOString(), new Date().toISOString(), memoryId]
    );
  } catch (e) {
    log.warn('Failed to reinforce memory:', e);
  }
}

/**
 * Renforce les souvenirs liés à un thème (ex: subconscient pense à la spiritualité)
 */
export async function reinforceByTheme(tamadachiId: string, theme: string): Promise<number> {
  try {
    const related = await findRelevantMemories(tamadachiId, theme, 10);
    let reinforced = 0;
    for (const mem of related) {
      await reinforceMemory(mem.id);
      reinforced++;
    }
    if (reinforced > 0) {
      log.info(`🔄 Reinforced ${reinforced} memories for theme: "${theme}"`);
    }
    return reinforced;
  } catch (e) {
    log.warn('Failed to reinforce by theme:', e);
    return 0;
  }
}

/**
 * Consolidation complète — comme le sommeil chez l'humain
 * 1. Renforce les souvenirs fréquemment accédés
 * 2. Groupe les souvenirs similaires en résumés
 * 3. Déplace les vieux souvenirs peu accédés en mémoire profonde
 * 4. Oublie les souvenirs très faibles (importance 1, jamais renforcés)
 */
export async function consolidateMemories(tamadachiId: string): Promise<number> {
  try {
    const db = await getDB();
    const allMemories = await queryMemories(tamadachiId, { orderBy: 'recent', limit: 500 });
    let actions = 0;
    const now = Date.now();

    for (const memory of allMemories) {
      if (memory.isFlash) continue; // Flash = permanent
      if (memory.memoryTier === 'deep' && memory.consolidatedInto) continue; // Déjà archivé

      const ageDays = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const reinforcements = memory.reinforcementCount || 0;
      const lastReinforced = memory.lastReinforcedAt
        ? (now - new Date(memory.lastReinforcedAt).getTime()) / (1000 * 60 * 60 * 24)
        : ageDays;

      // === RÈGLE 1: Souvenirs très renforcés → restent actifs (comme un humain) ===
      if (reinforcements >= 5 || memory.importance >= 8) {
        if (memory.memoryTier !== 'active') {
          await updateMemory(memory.id, { memory_tier: 'active' });
          actions++;
        }
        continue;
      }

      // === RÈGLE 2: Souvenirs > 7 jours, peu renforcés → consolidés ===
      if (ageDays > 7 && reinforcements < 3 && memory.memoryTier === 'active') {
        await updateMemory(memory.id, { memory_tier: 'consolidated' });
        // Decay d'importance
        const newImportance = Math.max(1, Math.round(memory.importance * 0.9));
        await updateMemory(memory.id, { importance: newImportance });
        actions++;
        continue;
      }

      // === RÈGLE 3: Souvenirs > 30 jours, jamais renforcés → mémoire profonde ===
      if (ageDays > 30 && reinforcements === 0 && memory.importance <= 3) {
        await updateMemory(memory.id, { memory_tier: 'deep' });
        actions++;
        continue;
      }

      // === RÈGLE 4: Souvenirs > 90 jours, importance 1, 0 renforcement → oubli ===
      if (ageDays > 90 && memory.importance <= 1 && reinforcements === 0) {
        await db.runAsync('DELETE FROM memories WHERE id = ?', [memory.id]);
        log.info(`🗑️ Forgot weak memory: "${memory.content.slice(0, 50)}..."`);
        actions++;
        continue;
      }

      // === RÈGLE 5: Decay naturel pour les souvenirs consolidés ===
      if (memory.memoryTier === 'consolidated' && lastReinforced > 14) {
        const newImportance = Math.max(1, memory.importance - 1);
        await updateMemory(memory.id, { importance: newImportance });
        actions++;
      }
    }

    if (actions > 0) {
      log.info(`🧠 Memory consolidation: ${actions} actions on ${allMemories.length} memories`);
    }

    return actions;
  } catch (error) {
    log.error('Failed to consolidate memories:', error);
    return 0;
  }
}

/**
 * Récupère les souvenirs par tier pour le prompt
 */
export async function getMemoriesByTier(tamadachiId: string, tier: 'active' | 'consolidated' | 'deep', limit: number = 50): Promise<Memory[]> {
  const db = await getDB();
  let rows: any[];
  try {
    // Essayer avec memory_tier si la colonne existe
    rows = await db.getAllAsync<any>(
      `SELECT * FROM memories WHERE tamadachi_id = ? AND memory_tier = ?
       ORDER BY importance DESC, reinforcement_count DESC
       LIMIT ?`,
      [tamadachiId, tier, limit]
    );
  } catch (_) {
    // Fallback: utiliser is_consolidated pour déterminer le tier
    let condition = 'is_consolidated = 0';
    if (tier === 'consolidated') condition = 'is_consolidated = 1';
    else if (tier === 'deep') condition = 'importance <= 3';
    rows = await db.getAllAsync<any>(
      `SELECT * FROM memories WHERE tamadachi_id = ? AND ` + condition + `
       ORDER BY importance DESC
       LIMIT ?`,
      [tamadachiId, limit]
    );
  }
  return rows.map((row: any) => ({
    id: row.id,
    tamadachiId: row.tamadachi_id,
    type: row.type,
    content: row.content,
    context: row.context,
    importance: row.importance,
    emotionalWeight: row.emotional_weight,
    accessCount: row.access_count || 0,
    lastAccessedAt: row.last_accessed_at,
    isConsolidated: row.is_consolidated === 1,
    isFlash: row.is_flash === 1,
    sourceConversationId: row.source_conversation_id,
    sourceMessageId: row.source_message_id,
    reinforcementCount: row.reinforcement_count || 0,
    memoryTier: row.memory_tier || 'active',
    consolidatedInto: row.consolidated_into || null,
    lastReinforcedAt: row.last_reinforced_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

// ============================================================
// STATISTIQUES
// ============================================================

/**
 * Retourne les stats de mémoire pour l'UI
 */
export async function getMemoryStats(tamadachiId: string): Promise<{
  total: number;
  byType: Record<MemoryType, number>;
  flashCount: number;
  avgImportance: number;
}> {
  const total = await countMemories(tamadachiId);

  const types: MemoryType[] = ['fact', 'event', 'emotion', 'preference', 'relationship', 'topic', 'flash'];
  const byType: Record<string, number> = {};

  for (const type of types) {
    const memories = await queryMemories(tamadachiId, { type, limit: 1000 });
    byType[type] = memories.length;
  }

  const flashMemories = await getFlashMemories(tamadachiId);
  const allMemories = await queryMemories(tamadachiId, { limit: 1000 });
  const avgImportance = allMemories.length > 0
    ? allMemories.reduce((sum, m) => sum + m.importance, 0) / allMemories.length
    : 0;

  return {
    total,
    byType: byType as Record<MemoryType, number>,
    flashCount: flashMemories.length,
    avgImportance: Math.round(avgImportance * 10) / 10,
  };
}

// ============================================================
// HELPERS INTERNES
// ============================================================

/**
 * Extrait le contexte autour d'un match dans un texte
 */
function extractContext(text: string, match: string, maxLength: number): string {
  const index = text.toLowerCase().indexOf(match.toLowerCase());
  if (index === -1) return truncate(text, maxLength);

  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + match.length + 50);
  let context = text.substring(start, end).trim();

  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return truncate(context, maxLength);
}

// ============================================================
// RESET (pour debug/test)
// ============================================================

/**
 * Note : le reset des memories se fait via DatabaseService.resetDatabase()
 * Ce service n'a pas de reset spécifique car tout est en DB
 */
export function getMemoryServiceInfo(): string {
  return `MemoryService — Config: min_importance=${MEMORY_CONFIG.extraction.minImportance}, max_per_message=${MEMORY_CONFIG.extraction.maxMemoriesPerMessage}, flash_threshold=${MEMORY_CONFIG.extraction.flashThreshold}`;
}

// ============================================================
// FONCTIONS MANQUANTES (utilisées par Subconscious et Dream)
// ============================================================

/**
 * Retourne les N souvenirs les plus importants
 */
export async function getTopMemories(tamadachiId: string, count: number = 10): Promise<Memory[]> {
  try {
    const allMemories = await queryMemories(tamadachiId, {
      orderBy: 'importance',
      limit: count * 3,
    });
    // Fallback: aussi chercher les facts si la query générale échoue
    const factMemories = await getMemoriesByType(tamadachiId, 'fact');
    const combined = [...allMemories, ...factMemories];
    const seen = new Set<string>();
    const unique = combined.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
    return unique.sort((a, b) => b.importance - a.importance).slice(0, count);
  } catch (error) {
    return [];
  }
}

/**
 * Retourne les N souvenirs les plus récents
 */
export async function getRecentMemories(tamadachiId: string, count: number = 5): Promise<Memory[]> {
  try {
    const stats = await getMemoryStats(tamadachiId);
    // Utiliser findRelevantMemories avec un terme vide pour obtenir les récents
    const all = await getMemoriesByType(tamadachiId, 'event');
    const facts = await getUserFacts(tamadachiId);
    const combined = [...all, ...facts];

    // Trier par date décroissante
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return combined.slice(0, count);
  } catch (error) {
    return [];
  }
}

/**
 * Recherche des souvenirs par mot-clé (délègue à la DB FTS)
 * NOTE: ne PAS appeler findRelevantMemories ici (boucle infinie)
 */
// Re-export from DatabaseService (no recursion)
export { dbSearchMemories as searchMemories };
