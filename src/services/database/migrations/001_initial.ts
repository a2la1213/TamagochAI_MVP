// src/services/database/migrations/001_initial.ts
// Migration initiale — Création de toutes les tables
//
// TABLES :
// 1. tamadachi        — L'entité principale (1 seul row pour le MVP)
// 2. conversations     — Historique des conversations
// 3. messages          — Messages de chaque conversation
// 4. memories          — Souvenirs extraits (avec FTS5)
// 5. hormone_state     — État hormonal actuel (1 row)
// 6. hormone_history   — Historique des snapshots hormonaux
// 7. xp_events         — Historique des gains d'XP
// 8. evolution_events  — Historique des changements de stade
// 9. daily_stats       — Statistiques journalières
// 10. settings         — Paramètres de l'app (key-value)

export const MIGRATION_001 = `
-- ============================================================
-- TABLE 1: TAMAGOCHAI (entité principale)
-- ============================================================
CREATE TABLE IF NOT EXISTS tamadachi (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  birth_date TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- Génome (ADN immuable)
  genome_social INTEGER NOT NULL DEFAULT 50,
  genome_cognitive INTEGER NOT NULL DEFAULT 50,
  genome_emotional INTEGER NOT NULL DEFAULT 50,
  genome_energy INTEGER NOT NULL DEFAULT 50,
  genome_creativity INTEGER NOT NULL DEFAULT 50,
  
  -- Évolution
  stage TEXT NOT NULL DEFAULT 'emergence',
  total_xp INTEGER NOT NULL DEFAULT 0,
  stage_started_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  -- État émotionnel actuel
  current_emotion TEXT NOT NULL DEFAULT 'neutral',
  current_mood TEXT NOT NULL DEFAULT 'neutre',
  
  -- Avatar
  avatar_type TEXT NOT NULL DEFAULT 'robot',
  avatar_style TEXT NOT NULL DEFAULT 'neutral',
  avatar_color TEXT NOT NULL DEFAULT '#3B82F6',
  
  -- Stats
  total_messages INTEGER NOT NULL DEFAULT 0,
  total_conversations INTEGER NOT NULL DEFAULT 0,
  total_memories INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_interaction TEXT,
  average_session_minutes REAL NOT NULL DEFAULT 0,
  favorite_time_of_day TEXT,
  
  -- Lifecycle
  is_alive INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- TABLE 2: CONVERSATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY NOT NULL,
  tamadachi_id TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  topics TEXT DEFAULT '[]',
  mood TEXT DEFAULT 'neutre',
  
  -- Stats
  message_count INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  memories_created INTEGER NOT NULL DEFAULT 0,
  
  -- Lifecycle
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT,
  end_reason TEXT,
  
  FOREIGN KEY (tamadachi_id) REFERENCES tamadachi(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_tamadachi 
  ON conversations(tamadachi_id);
CREATE INDEX IF NOT EXISTS idx_conversations_active 
  ON conversations(is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_created 
  ON conversations(created_at DESC);

-- ============================================================
-- TABLE 3: MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY NOT NULL,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Méta LLM
  tokens_used INTEGER DEFAULT 0,
  generation_time_ms INTEGER DEFAULT 0,
  provider TEXT,
  
  -- État au moment du message
  emotion_at_time TEXT,
  hormone_dopamine REAL,
  hormone_serotonin REAL,
  hormone_oxytocin REAL,
  hormone_cortisol REAL,
  hormone_adrenaline REAL,
  hormone_endorphins REAL,
  
  -- Flags
  is_edited INTEGER NOT NULL DEFAULT 0,
  is_regenerated INTEGER NOT NULL DEFAULT 0,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation 
  ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created 
  ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role 
  ON messages(role);

-- ============================================================
-- TABLE 4: MEMORIES (avec FTS5 pour recherche full-text)
-- ============================================================
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY NOT NULL,
  tamadachi_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('fact', 'event', 'emotion', 'preference', 'relationship', 'topic', 'flash')),
  content TEXT NOT NULL,
  context TEXT,
  
  -- Importance et pertinence
  importance INTEGER NOT NULL DEFAULT 5,
  emotional_weight INTEGER NOT NULL DEFAULT 0,
  access_count INTEGER NOT NULL DEFAULT 0,
  
  -- Lifecycle
  last_accessed_at TEXT,
  is_consolidated INTEGER NOT NULL DEFAULT 0,
  is_flash INTEGER NOT NULL DEFAULT 0,
  
  -- Source
  source_conversation_id TEXT,
  source_message_id TEXT,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (tamadachi_id) REFERENCES tamadachi(id) ON DELETE CASCADE,
  FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_tamadachi 
  ON memories(tamadachi_id);
CREATE INDEX IF NOT EXISTS idx_memories_type 
  ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_importance 
  ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_memories_flash 
  ON memories(is_flash);

-- Table FTS5 pour recherche full-text dans les souvenirs
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  content,
  context,
  content='memories',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- Triggers pour maintenir la FTS synchronisée
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, content, context) 
  VALUES (new.rowid, new.content, new.context);
END;

CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, context) 
  VALUES('delete', old.rowid, old.content, old.context);
END;

CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, content, context) 
  VALUES('delete', old.rowid, old.content, old.context);
  INSERT INTO memories_fts(rowid, content, context) 
  VALUES (new.rowid, new.content, new.context);
END;

-- ============================================================
-- TABLE 5: HORMONE_STATE (état actuel — 1 seul row)
-- ============================================================
CREATE TABLE IF NOT EXISTS hormone_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tamadachi_id TEXT NOT NULL,
  
  dopamine REAL NOT NULL DEFAULT 60,
  serotonin REAL NOT NULL DEFAULT 55,
  oxytocin REAL NOT NULL DEFAULT 40,
  cortisol REAL NOT NULL DEFAULT 25,
  adrenaline REAL NOT NULL DEFAULT 30,
  endorphins REAL NOT NULL DEFAULT 40,
  
  last_decay_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (tamadachi_id) REFERENCES tamadachi(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE 6: HORMONE_HISTORY (snapshots historiques)
-- ============================================================
CREATE TABLE IF NOT EXISTS hormone_history (
  id TEXT PRIMARY KEY NOT NULL,
  tamadachi_id TEXT NOT NULL,
  
  dopamine REAL NOT NULL,
  serotonin REAL NOT NULL,
  oxytocin REAL NOT NULL,
  cortisol REAL NOT NULL,
  adrenaline REAL NOT NULL,
  endorphins REAL NOT NULL,
  
  trigger_event TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (tamadachi_id) REFERENCES tamadachi(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_hormone_history_tamadachi 
  ON hormone_history(tamadachi_id);
CREATE INDEX IF NOT EXISTS idx_hormone_history_recorded 
  ON hormone_history(recorded_at DESC);

-- ============================================================
-- TABLE 7: XP_EVENTS (historique des gains d'XP)
-- ============================================================
CREATE TABLE IF NOT EXISTS xp_events (
  id TEXT PRIMARY KEY NOT NULL,
  tamadachi_id TEXT NOT NULL,
  source TEXT NOT NULL,
  amount INTEGER NOT NULL,
  multiplier REAL NOT NULL DEFAULT 1,
  final_amount INTEGER NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (tamadachi_id) REFERENCES tamadachi(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_xp_events_tamadachi 
  ON xp_events(tamadachi_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_created 
  ON xp_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_source 
  ON xp_events(source);

-- ============================================================
-- TABLE 8: EVOLUTION_EVENTS (transitions de stade)
-- ============================================================
CREATE TABLE IF NOT EXISTS evolution_events (
  id TEXT PRIMARY KEY NOT NULL,
  tamadachi_id TEXT NOT NULL,
  from_stage TEXT NOT NULL,
  to_stage TEXT NOT NULL,
  total_xp_at_transition INTEGER NOT NULL,
  memories_at_transition INTEGER NOT NULL DEFAULT 0,
  conversations_at_transition INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (tamadachi_id) REFERENCES tamadachi(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evolution_events_tamadachi 
  ON evolution_events(tamadachi_id);

-- ============================================================
-- TABLE 9: DAILY_STATS (statistiques journalières)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_stats (
  id TEXT PRIMARY KEY NOT NULL,
  tamadachi_id TEXT NOT NULL,
  date TEXT NOT NULL,
  
  messages_sent INTEGER NOT NULL DEFAULT 0,
  messages_received INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  memories_created INTEGER NOT NULL DEFAULT 0,
  conversations_count INTEGER NOT NULL DEFAULT 0,
  session_minutes REAL NOT NULL DEFAULT 0,
  
  -- Émotion dominante du jour
  dominant_emotion TEXT,
  average_mood_score REAL,
  
  -- Hormones moyennes du jour
  avg_dopamine REAL,
  avg_serotonin REAL,
  avg_oxytocin REAL,
  avg_cortisol REAL,
  avg_adrenaline REAL,
  avg_endorphins REAL,
  
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (tamadachi_id) REFERENCES tamadachi(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date 
  ON daily_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_stats_tamadachi 
  ON daily_stats(tamadachi_id, date DESC);

-- ============================================================
-- TABLE 10: SETTINGS (paramètres key-value)
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- DONNÉES INITIALES
-- ============================================================

-- Insérer les settings par défaut
INSERT OR IGNORE INTO settings (key, value) VALUES ('xp_mode', 'prototype');
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'light');
INSERT OR IGNORE INTO settings (key, value) VALUES ('notifications_enabled', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('haptics_enabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_save_enabled', 'true');
INSERT OR IGNORE INTO settings (key, value) VALUES ('debug_mode', 'false');
INSERT OR IGNORE INTO settings (key, value) VALUES ('preferred_provider', 'gemini');
INSERT OR IGNORE INTO settings (key, value) VALUES ('local_model_id', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('schema_version', '1');
`;
