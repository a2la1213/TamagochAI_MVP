// src/types/emotion.ts
// Système émotionnel — MVP COMPLET

// ============================================================
// TYPES D'ÉMOTIONS
// ============================================================
export type EmotionType =
  | 'joy'           // Joie — content, heureux
  | 'sadness'       // Tristesse — déçu, mélancolique
  | 'anger'         // Colère — frustré, agacé
  | 'fear'          // Peur — anxieux, inquiet
  | 'love'          // Amour — attaché, affectueux
  | 'surprise'      // Surprise — étonné, impressionné
  | 'curiosity'     // Curiosité — intéressé, exploratif
  | 'neutral';      // Neutre — calme, stable

// ============================================================
// ÉTAT ÉMOTIONNEL
// ============================================================
export interface EmotionState {
  primary: EmotionType;         // Émotion dominante
  secondary: EmotionType | null; // Émotion secondaire
  intensity: number;             // 0-100 intensité
  emoji: string;                 // Emoji représentatif
  description: string;           // Description textuelle
  timestamp: string;
}

// ============================================================
// CONFIG PAR ÉMOTION
// ============================================================
export interface EmotionConfig {
  type: EmotionType;
  emoji: string;
  label: string;
  description: string;
  color: string;             // Couleur UI associée
  avatarExpression: string;  // Expression avatar correspondante
}

// ============================================================
// FORMULE : HORMONES → ÉMOTION
// ============================================================
export interface EmotionFormula {
  emotion: EmotionType;
  calculate: (hormones: {
    dopamine: number;
    serotonin: number;
    oxytocin: number;
    cortisol: number;
    adrenaline: number;
    endorphins: number;
  }) => number; // Score 0-100
}
