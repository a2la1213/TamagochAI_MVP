// src/types/tamadachi.ts
// Types principaux du TamadachAI — MVP COMPLET

// ============================================================
// GÉNOME (ADN de l'IA — généré à la naissance, immuable)
// ============================================================
export interface Genome {
  social: number;       // 0-100 : Introverti ↔ Extraverti
  cognitive: number;    // 0-100 : Intuitif ↔ Analytique
  emotional: number;    // 0-100 : Stoïque ↔ Sensible
  energy: number;       // 0-100 : Calme ↔ Hyperactif
  creativity: number;   // 0-100 : Pragmatique ↔ Créatif
}

// ============================================================
// STADES D'ÉVOLUTION
// ============================================================
export type EvolutionStage =
  | 'emergence'       // Bébé IA — curieux, naïf, 500 mots
  | 'learning'        // Enfant — apprend, questions, 2000 mots
  | 'individuation'   // Ado — opinions, humour, 5000 mots
  | 'wisdom'          // Adulte — sage, profond, vocabulaire complet
  | 'transcendance';  // Transcendant — philosophe, poétique

// ============================================================
// AVATAR
// ============================================================
export type AvatarType =
  | 'robot'
  | 'humanoid'
  | 'creature'
  | 'spirit'
  | 'animal'
  | 'abstract';

export type AvatarStyle = 'feminine' | 'masculine' | 'neutral';

export type AvatarExpression =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'scared'
  | 'loving';

export interface AvatarConfig {
  type: AvatarType;
  style: AvatarStyle;
  color: string;
  currentExpression: AvatarExpression;
}

// ============================================================
// STATISTIQUES
// ============================================================
export interface TamadachiStats {
  totalMessages: number;
  totalConversations: number;
  totalMemories: number;
  totalXP: number;
  currentStage: EvolutionStage;
  daysSinceBirth: number;
  totalDays: number;
  longestStreak: number;
  currentStreak: number;
  lastInteraction: string | null;
  averageSessionMinutes: number;
  favoriteTimeOfDay: string | null;
}

// ============================================================
// ENTITÉ PRINCIPALE
// ============================================================
export interface Tamadachi {
  id: string;
  name: string;
  birthDate: string;
  genome: Genome;

  // Évolution
  stage: EvolutionStage;
  currentConversationId: string | null;
  totalXP: number;
  stageStartedAt: string;

  // État émotionnel actuel
  currentEmotion: string;
  currentMood: string;

  // Avatar
  avatar: AvatarConfig;

  // Stats
  stats: TamadachiStats;

  // Méta
  isAlive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// CRÉATION
// ============================================================
export interface CreateTamadachiData {
  name: string;
  avatarType: AvatarType;
  avatarStyle: AvatarStyle;
  avatarColor: string;
}

// ============================================================
// MISE À JOUR
// ============================================================
export interface UpdateTamadachiData {
  name?: string;
  stage?: EvolutionStage;
  totalXP?: number;
  currentEmotion?: string;
  currentMood?: string;
  avatar?: Partial<AvatarConfig>;
  isAlive?: boolean;
}

// ============================================================
// TYPES MÉTACOGNITION
// ============================================================

export type ThoughtType =
  | 'awakening'
  | 'reflection'
  | 'memory_review'
  | 'anticipation'
  | 'curiosity'
  | 'worry'
  | 'emotion_processing'
  | 'longing'
  | 'wandering'
  | 'dormancy'
  | 'dream';

export interface InternalThought {
  id: string;
  type: ThoughtType;
  content: string;
  createdAt: string;
  emotionAtTime: string;
  intensity: number;          // 0-100
  relatedMemories: string[];  // IDs
  influencesNextResponse: boolean;
}

export interface Dream {
  id: string;
  title: string;
  narrative: string;
  fragments: DreamFragment[];
  emotionTone: import('./emotion').EmotionType;
  createdAt: string;
  wasShared: boolean;
  lucidity: number;           // 0-1 (clarté du rêve)
}

export interface DreamFragment {
  content: string;
  sourceMemoryId?: string;
  distortion: 'literal' | 'symbolic' | 'surreal' | 'nightmare';
}
