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
): Promise<string | null> {
  try {
    // Anti-doublon
    const exists = await memoryExists(tamadachiId, memory.content);
    if (exists) {
      log.debug(`Memory already exists, skipping: ${truncate(memory.content, 50)}`);
      return null;
    }

    const id = await createMemory(tamadachiId, memory.type, memory.content, {
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
    const id = await storeMemory(tamadachiId, memory, conversationId, messageId);
    if (id) {
      created.push(memory.content);
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
  limit: number = 25,
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

  // 1. COUCHE RÉCENTE — Les 8 derniers souvenirs (mémoire courte)
  try {
    const recentMemories = await queryMemories(tamadachiId, {
      orderBy: 'recent',
      limit: 8,
    });
    addUnique(recentMemories);
    log.debug(`Memory layer 1 (recent): ${recentMemories.length} found`);
  } catch (e) {
    log.debug('Recent memories query failed');
  }

  // 2. COUCHE FTS — Recherche par mots-clés du message
  if (keywords.length > 0) {
    // Essayer chaque mot-clé individuellement si le OR échoue
    const searchQuery = keywords.join(' OR ');
    try {
      const ftsResults = await searchMemories(tamadachiId, searchQuery, Math.ceil(limit / 3));
      addUnique(ftsResults);
      log.debug(`Memory layer 2 (FTS): ${ftsResults.length} found for "${searchQuery}"`);
    } catch (error) {
      // Essayer mot par mot en fallback
      for (const kw of keywords.slice(0, 5)) {
        try {
          const kwResults = await searchMemories(tamadachiId, kw, 3);
          addUnique(kwResults);
        } catch (e) { /* ignore individual failures */ }
      }
      log.debug('FTS OR failed, tried individual keywords');
    }
  }

  // 3. COUCHE FLASH — Les flash memories (moments forts)
  try {
    const flashMemories = await queryMemories(tamadachiId, {
      type: 'flash',
      orderBy: 'importance',
      limit: 5,
    });
    addUnique(flashMemories);
    log.debug(`Memory layer 3 (flash): ${flashMemories.length} found`);
  } catch (e) {
    log.debug('Flash memories query failed');
  }

  // 4. COUCHE IMPORTANCE — Les souvenirs les plus importants (tous types)
  const remaining = limit - results.length;
  if (remaining > 0) {
    const topMemories = await getTopMemories(tamadachiId, remaining + 5);
    addUnique(topMemories);
    log.debug(`Memory layer 4 (top): ${topMemories.length} found`);
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
  limit: number = 25,
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

// ============================================================
// CONSOLIDATION (nettoyage et maintenance)
// ============================================================

/**
 * Consolide les souvenirs anciens :
 * - Réduit l'importance des souvenirs non-flash avec le temps
 * - Marque les souvenirs consolidés
 */
export async function consolidateMemories(tamadachiId: string): Promise<number> {
  try {
    const allMemories = await queryMemories(tamadachiId, {
      orderBy: 'recent',
      limit: 500,
    });

    let consolidated = 0;

    for (const memory of allMemories) {
      // Les flash memories sont immunisés
      if (memory.isFlash) continue;
      // Déjà consolidé
      if (memory.isConsolidated) continue;

      // Vérifier l'âge
      const ageHours = (Date.now() - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60);
      if (ageHours < MEMORY_CONFIG.consolidation.minAgeHours) continue;

      // Appliquer le decay d'importance
      const newImportance = Math.max(
        1,
        Math.round(memory.importance * MEMORY_CONFIG.consolidation.decayFactor),
      );

      if (newImportance !== memory.importance) {
        await updateMemory(memory.id, {
          importance: newImportance,
          is_consolidated: 1,
        });
        consolidated++;
      }
    }

    if (consolidated > 0) {
      log.info(`Consolidated ${consolidated} memories`);
    }

    return consolidated;
  } catch (error) {
    log.error('Failed to consolidate memories:', error);
    return 0;
  }
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
 * Recherche des souvenirs par mot-clé
 */
export async function searchMemories(tamadachiId: string, query: string, count: number = 5): Promise<Memory[]> {
  return findRelevantMemories(tamadachiId, query, count);
}
