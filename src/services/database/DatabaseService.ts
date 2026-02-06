// src/services/database/DatabaseService.ts
// Service de base de données SQLite — MVP COMPLET
//
// Ce service encapsule TOUTES les opérations de base de données.
// Il est le seul point d'accès à SQLite dans toute l'app.
// Aucun autre fichier n'importe expo-sqlite directement.
//
// Pattern : Singleton — une seule instance de DB dans toute l'app.

import * as SQLite from 'expo-sqlite';
import { MIGRATION_001 } from './migrations/001_initial';
import { DB_CONFIG } from '../../constants/config';
import { createLogger, generateId, now } from '../../utils/helpers';
import {
  Tamadachi,
  Genome,
  EvolutionStage,
  AvatarConfig,
  Conversation,
  Message,
  MessageRole,
  Memory,
  MemoryType,
  MemoryQuery,
  HormoneLevels,
  HormoneHistoryEntry,
  XPEvent,
  XPSource,
  EvolutionEvent,
} from '../../types';

const log = createLogger('DB');

// ============================================================
// SINGLETON
// ============================================================

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_CONFIG.name);
    log.info('Database opened:', DB_CONFIG.name);
  }
  return dbInstance;
}

// ============================================================
// INITIALISATION
// ============================================================

/**
 * Initialise la base de données : pragmas + migration
 */
export async function initDatabase(): Promise<void> {
  try {
    const db = await getDB();

    // Pragmas de performance
    await db.execAsync(`
      PRAGMA journal_mode = ${DB_CONFIG.pragmas.journalMode};
      PRAGMA synchronous = ${DB_CONFIG.pragmas.synchronous};
      PRAGMA foreign_keys = ${DB_CONFIG.pragmas.foreignKeys ? 'ON' : 'OFF'};
      PRAGMA cache_size = ${DB_CONFIG.pragmas.cacheSize};
      PRAGMA temp_store = ${DB_CONFIG.pragmas.tempStore};
    `);
    log.info('Pragmas set');

    // Exécuter la migration initiale
    await db.execAsync(MIGRATION_001);
    log.info('Migration 001 applied');

    log.info('✅ Database initialized successfully');
  } catch (error) {
    log.error('❌ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Ferme la base de données proprement
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
    log.info('Database closed');
  }
}

/**
 * Reset complet — supprime toutes les données (pour debug/test)
 */
export async function resetDatabase(): Promise<void> {
  try {
    const db = await getDB();
    await db.execAsync(`
      DELETE FROM hormone_history;
      DELETE FROM xp_events;
      DELETE FROM evolution_events;
      DELETE FROM daily_stats;
      DELETE FROM messages;
      DELETE FROM memories;
      DELETE FROM conversations;
      DELETE FROM hormone_state;
      DELETE FROM tamadachi;
      DELETE FROM settings;
    `);
    // Réappliquer la migration pour les settings par défaut
    await db.execAsync(MIGRATION_001);
    log.info('✅ Database reset complete');
  } catch (error) {
    log.error('❌ Database reset failed:', error);
    throw error;
  }
}

// ============================================================
// TAMAGOCHAI — CRUD
// ============================================================

/**
 * Crée un nouveau TamadachAI
 */
export async function createTamadachi(
  name: string,
  genome: Genome,
  avatarType: string,
  avatarStyle: string,
  avatarColor: string,
): Promise<string> {
  const db = await getDB();
  const id = generateId();
  const timestamp = now();

  await db.runAsync(
    `INSERT INTO tamadachi (
      id, name, birth_date,
      genome_social, genome_cognitive, genome_emotional, genome_energy, genome_creativity,
      stage, total_xp, stage_started_at,
      current_emotion, current_mood,
      avatar_type, avatar_style, avatar_color,
      is_alive, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, name, timestamp,
    genome.social, genome.cognitive, genome.emotional, genome.energy, genome.creativity,
    'emergence', 0, timestamp,
    'curiosity', 'neutre',
    avatarType, avatarStyle, avatarColor,
    1, timestamp, timestamp,
  );

  // Créer l'état hormonal initial
  await db.runAsync(
    `INSERT INTO hormone_state (id, tamadachi_id, dopamine, serotonin, oxytocin, cortisol, adrenaline, endorphins, last_decay_at, updated_at)
     VALUES (1, ?, 60, 55, 40, 25, 30, 40, ?, ?)`,
    id, timestamp, timestamp,
  );

  log.info(`✅ TamadachAI created: ${name} (${id})`);
  return id;
}

/**
 * Récupère le TamadachAI (il n'y en a qu'un dans le MVP)
 */
export async function getTamadachi(): Promise<Tamadachi | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM tamadachi WHERE is_alive = 1 LIMIT 1'
  );

  if (!row) return null;

  return mapRowToTamadachi(row);
}

/**
 * Met à jour le TamadachAI
 */
export async function updateTamadachi(
  id: string,
  updates: Record<string, any>,
): Promise<void> {
  const db = await getDB();
  const timestamp = now();

  // Construire la requête dynamiquement
  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  fields.push('updated_at = ?');
  values.push(timestamp);
  values.push(id);

  await db.runAsync(
    `UPDATE tamadachi SET ${fields.join(', ')} WHERE id = ?`,
    ...values,
  );
}

/**
 * Met à jour les stats du TamadachAI
 */
export async function updateTamadachiStats(
  id: string,
  stats: Partial<{
    total_messages: number;
    total_conversations: number;
    total_memories: number;
    total_xp: number;
    stage: string;
    current_emotion: string;
    current_mood: string;
    longest_streak: number;
    current_streak: number;
    last_interaction: string;
  }>,
): Promise<void> {
  await updateTamadachi(id, stats);
}

/**
 * Incrémente un compteur du TamadachAI
 */
export async function incrementTamadachiStat(
  id: string,
  field: string,
  amount: number = 1,
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE tamadachi SET ${field} = ${field} + ?, updated_at = ? WHERE id = ?`,
    amount, now(), id,
  );
}

// ============================================================
// CONVERSATIONS — CRUD
// ============================================================

/**
 * Crée une nouvelle conversation
 */
export async function createConversation(
  tamadachiId: string,
  title?: string,
): Promise<string> {
  const db = await getDB();
  const id = generateId();
  const timestamp = now();

  await db.runAsync(
    `INSERT INTO conversations (id, tamadachi_id, title, is_active, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
    id, tamadachiId, title || null, timestamp, timestamp,
  );

  log.info(`Conversation created: ${id}`);
  return id;
}

/**
 * Récupère la conversation active
 */
export async function getActiveConversation(
  tamadachiId: string,
): Promise<Conversation | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM conversations 
     WHERE tamadachi_id = ? AND is_active = 1 
     ORDER BY updated_at DESC LIMIT 1`,
    tamadachiId,
  );

  if (!row) return null;
  return mapRowToConversation(row);
}

/**
 * Liste toutes les conversations
 */
export async function getConversations(
  tamadachiId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<Conversation[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM conversations 
     WHERE tamadachi_id = ? 
     ORDER BY updated_at DESC 
     LIMIT ? OFFSET ?`,
    tamadachiId, limit, offset,
  );

  return rows.map(mapRowToConversation);
}

/**
 * Termine une conversation
 */
export async function endConversation(
  conversationId: string,
  reason: string = 'user_ended',
): Promise<void> {
  const db = await getDB();
  const timestamp = now();

  await db.runAsync(
    `UPDATE conversations 
     SET is_active = 0, ended_at = ?, end_reason = ?, updated_at = ? 
     WHERE id = ?`,
    timestamp, reason, timestamp, conversationId,
  );
}

/**
 * Met à jour une conversation
 */
export async function updateConversation(
  conversationId: string,
  updates: Partial<{
    title: string;
    summary: string;
    topics: string;
    mood: string;
    message_count: number;
    xp_earned: number;
    memories_created: number;
  }>,
): Promise<void> {
  const db = await getDB();
  const timestamp = now();

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  fields.push('updated_at = ?');
  values.push(timestamp);
  values.push(conversationId);

  await db.runAsync(
    `UPDATE conversations SET ${fields.join(', ')} WHERE id = ?`,
    ...values,
  );
}

/**
 * Incrémente un compteur de conversation
 */
export async function incrementConversationStat(
  conversationId: string,
  field: string,
  amount: number = 1,
): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `UPDATE conversations SET ${field} = ${field} + ?, updated_at = ? WHERE id = ?`,
    amount, now(), conversationId,
  );
}

// ============================================================
// MESSAGES — CRUD
// ============================================================

/**
 * Insère un message
 */
export async function insertMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  meta?: {
    tokensUsed?: number;
    generationTimeMs?: number;
    provider?: string;
    emotionAtTime?: string;
    hormones?: HormoneLevels;
  },
): Promise<string> {
  const db = await getDB();
  const id = generateId();

  await db.runAsync(
    `INSERT INTO messages (
      id, conversation_id, role, content,
      tokens_used, generation_time_ms, provider,
      emotion_at_time,
      hormone_dopamine, hormone_serotonin, hormone_oxytocin,
      hormone_cortisol, hormone_adrenaline, hormone_endorphins,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, conversationId, role, content,
    meta?.tokensUsed || 0,
    meta?.generationTimeMs || 0,
    meta?.provider || null,
    meta?.emotionAtTime || null,
    meta?.hormones?.dopamine || null,
    meta?.hormones?.serotonin || null,
    meta?.hormones?.oxytocin || null,
    meta?.hormones?.cortisol || null,
    meta?.hormones?.adrenaline || null,
    meta?.hormones?.endorphins || null,
    now(),
  );

  return id;
}

/**
 * Récupère les messages d'une conversation
 */
export async function getMessages(
  conversationId: string,
  limit: number = 100,
  offset: number = 0,
): Promise<Message[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM messages 
     WHERE conversation_id = ? 
     ORDER BY created_at ASC 
     LIMIT ? OFFSET ?`,
    conversationId, limit, offset,
  );

  return rows.map(mapRowToMessage);
}

/**
 * Récupère les N derniers messages d'une conversation
 */
export async function getRecentMessages(
  conversationId: string,
  limit: number = 20,
): Promise<Message[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM (
       SELECT * FROM messages 
       WHERE conversation_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?
     ) sub ORDER BY created_at ASC`,
    conversationId, limit,
  );

  return rows.map(mapRowToMessage);
}

/**
 * Compte les messages d'une conversation
 */
export async function countMessages(conversationId: string): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
    conversationId,
  );
  return row?.count || 0;
}

/**
 * Récupère le dernier message d'une conversation
 */
export async function getLastMessage(
  conversationId: string,
): Promise<Message | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    `SELECT * FROM messages 
     WHERE conversation_id = ? 
     ORDER BY created_at DESC LIMIT 1`,
    conversationId,
  );
  if (!row) return null;
  return mapRowToMessage(row);
}

// ============================================================
// MEMORIES — CRUD + SEARCH
// ============================================================

/**
 * Crée un souvenir
 */
export async function createMemory(
  tamadachiId: string,
  type: MemoryType,
  content: string,
  options?: {
    context?: string;
    importance?: number;
    emotionalWeight?: number;
    isFlash?: boolean;
    sourceConversationId?: string;
    sourceMessageId?: string;
  },
): Promise<string> {
  const db = await getDB();
  const id = generateId();
  const timestamp = now();

  await db.runAsync(
    `INSERT INTO memories (
      id, tamadachi_id, type, content, context,
      importance, emotional_weight, is_flash,
      source_conversation_id, source_message_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, tamadachiId, type, content,
    options?.context || null,
    options?.importance || 5,
    options?.emotionalWeight || 0,
    options?.isFlash ? 1 : 0,
    options?.sourceConversationId || null,
    options?.sourceMessageId || null,
    timestamp, timestamp,
  );

  log.info(`Memory created: [${type}] ${content.substring(0, 50)}...`);
  return id;
}

/**
 * Recherche dans les souvenirs avec FTS5
 */
export async function searchMemories(
  tamadachiId: string,
  searchText: string,
  limit: number = 10,
): Promise<Memory[]> {
  const db = await getDB();

  const rows = await db.getAllAsync<any>(
    `SELECT m.* FROM memories m
     JOIN memories_fts fts ON m.rowid = fts.rowid
     WHERE fts.memories_fts MATCH ? AND m.tamadachi_id = ?
     ORDER BY rank
     LIMIT ?`,
    searchText, tamadachiId, limit,
  );

  return rows.map(mapRowToMemory);
}

/**
 * Récupère les souvenirs par requête structurée
 */
export async function queryMemories(
  tamadachiId: string,
  query: MemoryQuery,
): Promise<Memory[]> {
  const db = await getDB();

  let sql = 'SELECT * FROM memories WHERE tamadachi_id = ?';
  const params: any[] = [tamadachiId];

  if (query.type) {
    sql += ' AND type = ?';
    params.push(query.type);
  }

  if (query.minImportance) {
    sql += ' AND importance >= ?';
    params.push(query.minImportance);
  }

  // Tri
  switch (query.orderBy) {
    case 'importance':
      sql += ' ORDER BY importance DESC, created_at DESC';
      break;
    case 'accessed':
      sql += ' ORDER BY last_accessed_at DESC NULLS LAST, importance DESC';
      break;
    case 'recent':
    default:
      sql += ' ORDER BY created_at DESC';
      break;
  }

  sql += ' LIMIT ?';
  params.push(query.limit || 10);

  const rows = await db.getAllAsync<any>(sql, ...params);
  return rows.map(mapRowToMemory);
}

/**
 * Récupère les souvenirs les plus importants (pour le prompt LLM)
 */
export async function getTopMemories(
  tamadachiId: string,
  limit: number = 10,
): Promise<Memory[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM memories 
     WHERE tamadachi_id = ? 
     ORDER BY is_flash DESC, importance DESC, access_count DESC 
     LIMIT ?`,
    tamadachiId, limit,
  );
  return rows.map(mapRowToMemory);
}

/**
 * Met à jour un souvenir (accès, importance, etc.)
 */
export async function updateMemory(
  memoryId: string,
  updates: Partial<{
    importance: number;
    emotional_weight: number;
    is_consolidated: number;
  }>,
): Promise<void> {
  const db = await getDB();
  const timestamp = now();

  const fields: string[] = ['access_count = access_count + 1', 'last_accessed_at = ?', 'updated_at = ?'];
  const values: any[] = [timestamp, timestamp];

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  values.push(memoryId);

  await db.runAsync(
    `UPDATE memories SET ${fields.join(', ')} WHERE id = ?`,
    ...values,
  );
}

/**
 * Compte les souvenirs
 */
export async function countMemories(tamadachiId: string): Promise<number> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM memories WHERE tamadachi_id = ?',
    tamadachiId,
  );
  return row?.count || 0;
}

/**
 * Vérifie si un souvenir similaire existe déjà (anti-doublon)
 */
export async function memoryExists(
  tamadachiId: string,
  content: string,
): Promise<boolean> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM memories 
     WHERE tamadachi_id = ? AND content = ?`,
    tamadachiId, content,
  );
  return (row?.count || 0) > 0;
}

// ============================================================
// HORMONES — STATE + HISTORY
// ============================================================

/**
 * Récupère l'état hormonal actuel
 */
export async function getHormoneState(
  tamadachiId: string,
): Promise<{ levels: HormoneLevels; lastDecayAt: string } | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<any>(
    'SELECT * FROM hormone_state WHERE tamadachi_id = ?',
    tamadachiId,
  );

  if (!row) return null;

  return {
    levels: {
      dopamine: row.dopamine,
      serotonin: row.serotonin,
      oxytocin: row.oxytocin,
      cortisol: row.cortisol,
      adrenaline: row.adrenaline,
      endorphins: row.endorphins,
    },
    lastDecayAt: row.last_decay_at,
  };
}

/**
 * Sauvegarde l'état hormonal actuel
 */
export async function saveHormoneState(
  tamadachiId: string,
  levels: HormoneLevels,
): Promise<void> {
  const db = await getDB();
  const timestamp = now();

  await db.runAsync(
    `UPDATE hormone_state SET 
      dopamine = ?, serotonin = ?, oxytocin = ?,
      cortisol = ?, adrenaline = ?, endorphins = ?,
      last_decay_at = ?, updated_at = ?
     WHERE tamadachi_id = ?`,
    levels.dopamine, levels.serotonin, levels.oxytocin,
    levels.cortisol, levels.adrenaline, levels.endorphins,
    timestamp, timestamp,
    tamadachiId,
  );
}

/**
 * Ajoute un snapshot hormonal à l'historique
 */
export async function addHormoneHistoryEntry(
  tamadachiId: string,
  levels: HormoneLevels,
  triggerEvent: string,
): Promise<void> {
  const db = await getDB();
  const id = generateId();

  await db.runAsync(
    `INSERT INTO hormone_history (
      id, tamadachi_id, 
      dopamine, serotonin, oxytocin, cortisol, adrenaline, endorphins,
      trigger_event, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, tamadachiId,
    levels.dopamine, levels.serotonin, levels.oxytocin,
    levels.cortisol, levels.adrenaline, levels.endorphins,
    triggerEvent, now(),
  );
}

/**
 * Récupère l'historique hormonal récent
 */
export async function getHormoneHistory(
  tamadachiId: string,
  limit: number = 50,
): Promise<HormoneHistoryEntry[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM hormone_history 
     WHERE tamadachi_id = ? 
     ORDER BY recorded_at DESC 
     LIMIT ?`,
    tamadachiId, limit,
  );

  return rows.map(row => ({
    id: row.id,
    levels: {
      dopamine: row.dopamine,
      serotonin: row.serotonin,
      oxytocin: row.oxytocin,
      cortisol: row.cortisol,
      adrenaline: row.adrenaline,
      endorphins: row.endorphins,
    },
    triggerEvent: row.trigger_event,
    recordedAt: row.recorded_at,
  }));
}

// ============================================================
// XP EVENTS
// ============================================================

/**
 * Enregistre un gain d'XP
 */
export async function recordXPEvent(
  tamadachiId: string,
  source: XPSource,
  amount: number,
  multiplier: number,
  finalAmount: number,
  description: string,
): Promise<void> {
  const db = await getDB();
  const id = generateId();

  await db.runAsync(
    `INSERT INTO xp_events (id, tamadachi_id, source, amount, multiplier, final_amount, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, tamadachiId, source, amount, multiplier, finalAmount, description, now(),
  );
}

/**
 * Calcule l'XP gagné dans l'heure en cours
 */
export async function getXPThisHour(tamadachiId: string): Promise<number> {
  const db = await getDB();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(final_amount), 0) as total 
     FROM xp_events 
     WHERE tamadachi_id = ? AND created_at >= ?`,
    tamadachiId, oneHourAgo,
  );

  return row?.total || 0;
}

/**
 * Calcule l'XP gagné aujourd'hui
 */
export async function getXPToday(tamadachiId: string): Promise<number> {
  const db = await getDB();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(final_amount), 0) as total 
     FROM xp_events 
     WHERE tamadachi_id = ? AND created_at >= ?`,
    tamadachiId, today.toISOString(),
  );

  return row?.total || 0;
}

/**
 * Compte les gains d'XP consécutifs récents (pour diminishing returns)
 */
export async function getConsecutiveXPGains(
  tamadachiId: string,
  windowSeconds: number = 60,
): Promise<number> {
  const db = await getDB();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM xp_events 
     WHERE tamadachi_id = ? AND created_at >= ?`,
    tamadachiId, since,
  );

  return row?.count || 0;
}

// ============================================================
// EVOLUTION EVENTS
// ============================================================

/**
 * Enregistre une transition de stade
 */
export async function recordEvolutionEvent(
  tamadachiId: string,
  fromStage: EvolutionStage,
  toStage: EvolutionStage,
  totalXP: number,
  memoriesCount: number,
  conversationsCount: number,
): Promise<void> {
  const db = await getDB();
  const id = generateId();

  await db.runAsync(
    `INSERT INTO evolution_events (
      id, tamadachi_id, from_stage, to_stage,
      total_xp_at_transition, memories_at_transition, conversations_at_transition,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id, tamadachiId, fromStage, toStage,
    totalXP, memoriesCount, conversationsCount,
    now(),
  );

  log.info(`🌟 Evolution: ${fromStage} → ${toStage} at ${totalXP} XP`);
}

/**
 * Récupère l'historique d'évolution
 */
export async function getEvolutionHistory(
  tamadachiId: string,
): Promise<EvolutionEvent[]> {
  const db = await getDB();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM evolution_events 
     WHERE tamadachi_id = ? 
     ORDER BY created_at ASC`,
    tamadachiId,
  );

  return rows.map(row => ({
    id: row.id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    totalXPAtTransition: row.total_xp_at_transition,
    memoriesAtTransition: row.memories_at_transition,
    conversationsAtTransition: row.conversations_at_transition,
    createdAt: row.created_at,
  }));
}

// ============================================================
// DAILY STATS
// ============================================================

/**
 * Crée ou met à jour les stats du jour
 */
export async function upsertDailyStats(
  tamadachiId: string,
  updates: Partial<{
    messages_sent: number;
    messages_received: number;
    xp_earned: number;
    memories_created: number;
    conversations_count: number;
    session_minutes: number;
    dominant_emotion: string;
    average_mood_score: number;
  }>,
): Promise<void> {
  const db = await getDB();
  const today = new Date().toISOString().split('T')[0];
  const id = `${tamadachiId}_${today}`;

  // Vérifier si le row existe
  const existing = await db.getFirstAsync<any>(
    'SELECT id FROM daily_stats WHERE id = ?',
    id,
  );

  if (existing) {
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      // Pour les compteurs, incrémenter
      if (['messages_sent', 'messages_received', 'xp_earned', 'memories_created', 'conversations_count'].includes(key)) {
        fields.push(`${key} = ${key} + ?`);
      } else {
        fields.push(`${key} = ?`);
      }
      values.push(value);
    }

    values.push(id);
    await db.runAsync(
      `UPDATE daily_stats SET ${fields.join(', ')} WHERE id = ?`,
      ...values,
    );
  } else {
    const columns = ['id', 'tamadachi_id', 'date', ...Object.keys(updates)];
    const placeholders = columns.map(() => '?').join(', ');
    const values = [id, tamadachiId, today, ...Object.values(updates)];

    await db.runAsync(
      `INSERT INTO daily_stats (${columns.join(', ')}) VALUES (${placeholders})`,
      ...values,
    );
  }
}

/**
 * Récupère les stats des N derniers jours
 */
export async function getDailyStats(
  tamadachiId: string,
  days: number = 30,
): Promise<any[]> {
  const db = await getDB();
  return db.getAllAsync<any>(
    `SELECT * FROM daily_stats 
     WHERE tamadachi_id = ? 
     ORDER BY date DESC 
     LIMIT ?`,
    tamadachiId, days,
  );
}

// ============================================================
// SETTINGS
// ============================================================

/**
 * Récupère un setting
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  return row?.value || null;
}

/**
 * Sauvegarde un setting
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`,
    key, value, now(),
  );
}

/**
 * Récupère tous les settings
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );

  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ============================================================
// CLEANUP (nettoyage périodique)
// ============================================================

/**
 * Nettoie les anciennes données selon les limites configurées
 */
export async function cleanupOldData(tamadachiId: string): Promise<void> {
  const db = await getDB();
  const config = DB_CONFIG.cleanup;

  // Limiter l'historique hormonal
  await db.runAsync(
    `DELETE FROM hormone_history 
     WHERE tamadachi_id = ? AND id NOT IN (
       SELECT id FROM hormone_history 
       WHERE tamadachi_id = ? 
       ORDER BY recorded_at DESC 
       LIMIT ?
     )`,
    tamadachiId, tamadachiId, config.maxHormoneHistory,
  );

  // Limiter les events XP
  await db.runAsync(
    `DELETE FROM xp_events 
     WHERE tamadachi_id = ? AND id NOT IN (
       SELECT id FROM xp_events 
       WHERE tamadachi_id = ? 
       ORDER BY created_at DESC 
       LIMIT ?
     )`,
    tamadachiId, tamadachiId, config.maxXPEvents,
  );

  // Limiter les daily stats
  await db.runAsync(
    `DELETE FROM daily_stats 
     WHERE tamadachi_id = ? AND id NOT IN (
       SELECT id FROM daily_stats 
       WHERE tamadachi_id = ? 
       ORDER BY date DESC 
       LIMIT ?
     )`,
    tamadachiId, tamadachiId, config.maxDailyStats,
  );

  log.info('🧹 Cleanup complete');
}

// ============================================================
// ROW MAPPERS (SQL row → TypeScript object)
// ============================================================

function mapRowToTamadachi(row: any): Tamadachi {
  return {
    id: row.id,
    name: row.name,
    birthDate: row.birth_date,
    genome: {
      social: row.genome_social,
      cognitive: row.genome_cognitive,
      emotional: row.genome_emotional,
      energy: row.genome_energy,
      creativity: row.genome_creativity,
    },
    stage: row.stage as EvolutionStage,
    totalXP: row.total_xp,
    stageStartedAt: row.stage_started_at,
    currentEmotion: row.current_emotion,
    currentMood: row.current_mood,
    avatar: {
      type: row.avatar_type,
      style: row.avatar_style,
      color: row.avatar_color,
      currentExpression: 'neutral',
    } as AvatarConfig,
    stats: {
      totalMessages: row.total_messages,
      totalConversations: row.total_conversations,
      totalMemories: row.total_memories,
      totalXP: row.total_xp,
      currentStage: row.stage as EvolutionStage,
      totalDays: 0,
      daysSinceBirth: Math.floor(
        (Date.now() - new Date(row.birth_date).getTime()) / (1000 * 60 * 60 * 24)
      ),
      longestStreak: row.longest_streak,
      currentStreak: row.current_streak,
      lastInteraction: row.last_interaction,

      averageSessionMinutes: row.average_session_minutes,
      favoriteTimeOfDay: row.favorite_time_of_day,
    },
    isAlive: row.is_alive === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
      currentConversationId: row.current_conversation_id || null,
  };
}

function mapRowToConversation(row: any): Conversation {
  return {
    id: row.id,
    tamadachiId: row.tamadachi_id,
    title: row.title,
    summary: row.summary,
    topics: row.topics ? JSON.parse(row.topics) : [],
    mood: row.mood,
    messageCount: row.message_count,
    xpEarned: row.xp_earned,
    memoriesCreated: row.memories_created,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
  };
}

function mapRowToMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    content: row.content,
    tokensUsed: row.tokens_used,
    generationTimeMs: row.generation_time_ms,
    provider: row.provider,
    emotionAtTime: row.emotion_at_time,
    hormoneSnapshot: row.hormone_dopamine != null ? {
      dopamine: row.hormone_dopamine,
      serotonin: row.hormone_serotonin,
      oxytocin: row.hormone_oxytocin,
      cortisol: row.hormone_cortisol,
      adrenaline: row.hormone_adrenaline,
      endorphins: row.hormone_endorphins,
    } : undefined,
    isEdited: row.is_edited === 1,
    isRegenerated: row.is_regenerated === 1,
    createdAt: row.created_at,
  };
}

function mapRowToMemory(row: any): Memory {
  return {
    id: row.id,
    tamadachiId: row.tamadachi_id,
    type: row.type as MemoryType,
    content: row.content,
    context: row.context,
    importance: row.importance,
    emotionalWeight: row.emotional_weight,
    accessCount: row.access_count,
    lastAccessedAt: row.last_accessed_at,
    isConsolidated: row.is_consolidated === 1,
    isFlash: row.is_flash === 1,
    sourceConversationId: row.source_conversation_id,
    sourceMessageId: row.source_message_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
