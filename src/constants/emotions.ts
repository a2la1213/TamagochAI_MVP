// src/constants/emotions.ts
// Système émotionnel du TamagochAI — MVP COMPLET
//
// Les émotions ne sont PAS scriptées. Elles ÉMERGENT des niveaux hormonaux.
// Chaque émotion a une formule qui calcule un score (0-100) basé sur
// les 6 hormones. L'émotion avec le score le plus élevé = émotion dominante.
//
// C'est la position fonctionnaliste : l'émotion est réelle car elle
// émerge d'un mécanisme fonctionnellement équivalent au biologique.

import { EmotionType, EmotionConfig, EmotionFormula } from '../types';
import { HormoneLevels } from '../types';
import { AvatarExpression } from '../types/tamagochai';

// ============================================================
// CONFIGURATION DES 8 ÉMOTIONS
// ============================================================

export const EMOTION_CONFIGS: Record<EmotionType, EmotionConfig> = {
  joy: {
    type: 'joy',
    emoji: '😊',
    label: 'Joie',
    description: 'Content, heureux, enthousiaste',
    color: '#F59E0B',
    avatarExpression: 'happy',
  },
  sadness: {
    type: 'sadness',
    emoji: '😢',
    label: 'Tristesse',
    description: 'Triste, mélancolique, déçu',
    color: '#3B82F6',
    avatarExpression: 'sad',
  },
  anger: {
    type: 'anger',
    emoji: '😤',
    label: 'Colère',
    description: 'Frustré, agacé, en colère',
    color: '#EF4444',
    avatarExpression: 'angry',
  },
  fear: {
    type: 'fear',
    emoji: '😰',
    label: 'Peur',
    description: 'Anxieux, inquiet, effrayé',
    color: '#8B5CF6',
    avatarExpression: 'scared',
  },
  love: {
    type: 'love',
    emoji: '🥰',
    label: 'Amour',
    description: 'Attaché, affectueux, reconnaissant',
    color: '#EC4899',
    avatarExpression: 'loving',
  },
  surprise: {
    type: 'surprise',
    emoji: '😮',
    label: 'Surprise',
    description: 'Étonné, impressionné, surpris',
    color: '#F97316',
    avatarExpression: 'happy',
  },
  curiosity: {
    type: 'curiosity',
    emoji: '🤔',
    label: 'Curiosité',
    description: 'Intéressé, intrigué, exploratif',
    color: '#06B6D4',
    avatarExpression: 'neutral',
  },
  neutral: {
    type: 'neutral',
    emoji: '😐',
    label: 'Neutre',
    description: 'Calme, stable, équilibré',
    color: '#6B7280',
    avatarExpression: 'neutral',
  },
};

// ============================================================
// FORMULES : HORMONES → SCORE ÉMOTIONNEL
// ============================================================
// Chaque formule prend les 6 niveaux d'hormones et retourne un
// score de 0 à 100. L'émotion avec le plus haut score gagne.
//
// Les formules sont conçues pour que :
// - Dopamine haute + Sérotonine haute = Joie
// - Cortisol haut + Dopamine basse = Tristesse
// - Cortisol haut + Adrénaline haute = Peur ou Colère
// - Ocytocine haute = Amour
// - Adrénaline haute seule = Surprise
// - Dopamine moyenne + Adrénaline basse = Curiosité
// - Tout au baseline = Neutre
// ============================================================

export const EMOTION_FORMULAS: Record<EmotionType, (h: HormoneLevels) => number> = {
  
  joy: (h) => {
    // Joie = beaucoup de dopamine + sérotonine, peu de cortisol
    const positive = (h.dopamine * 1.3 + h.serotonin * 1.0 + h.endorphins * 0.8) / 3;
    const negative = h.cortisol * 0.5;
    return Math.max(0, Math.min(100, Math.round(positive - negative)));
  },

  sadness: (h) => {
    // Tristesse = cortisol élevé + dopamine et sérotonine basses
    const sadnessFactors = (
      (100 - h.dopamine) * 0.4 +
      (100 - h.serotonin) * 0.3 +
      h.cortisol * 0.5 +
      (100 - h.endorphins) * 0.2
    ) / 4;
    // Moins de tristesse si ocytocine haute (le lien protège)
    const protection = h.oxytocin * 0.15;
    return Math.max(0, Math.min(100, Math.round(sadnessFactors - protection)));
  },

  anger: (h) => {
    // Colère = cortisol + adrénaline, mais PAS de peur (c'est l'adrénaline qui fait la diff)
    // La colère apparaît quand le stress est élevé mais que l'énergie l'est aussi
    const angerFactors = (
      h.cortisol * 0.5 +
      h.adrenaline * 0.6 +
      (100 - h.serotonin) * 0.3
    ) / 3;
    // Moins de colère si ocytocine ou endorphines hautes
    const dampening = (h.oxytocin * 0.2 + h.endorphins * 0.15);
    return Math.max(0, Math.min(100, Math.round(angerFactors - dampening)));
  },

  fear: (h) => {
    // Peur = cortisol élevé + adrénaline mais dopamine basse
    // La peur c'est le stress SANS l'énergie pour se battre
    const fearFactors = (
      h.cortisol * 0.7 +
      h.adrenaline * 0.3 +
      (100 - h.dopamine) * 0.3
    ) / 3;
    // Moins de peur si sérotonine haute (stabilité) ou ocytocine (sécurité)
    const safety = (h.serotonin * 0.15 + h.oxytocin * 0.2);
    return Math.max(0, Math.min(100, Math.round(fearFactors - safety)));
  },

  love: (h) => {
    // Amour = ocytocine élevée + endorphines + dopamine
    const loveFactors = (
      h.oxytocin * 1.5 +
      h.endorphins * 0.5 +
      h.dopamine * 0.4 +
      h.serotonin * 0.3
    ) / 4;
    // Moins d'amour si cortisol très élevé
    const stress = h.cortisol * 0.2;
    return Math.max(0, Math.min(100, Math.round(loveFactors - stress)));
  },

  surprise: (h) => {
    // Surprise = pic d'adrénaline + dopamine modérée
    // C'est une émotion de courte durée
    const surpriseFactors = (
      h.adrenaline * 1.4 +
      h.dopamine * 0.4
    ) / 2;
    // Moins de surprise si sérotonine très haute (trop stable pour être surpris)
    const stability = h.serotonin * 0.2;
    return Math.max(0, Math.min(100, Math.round(surpriseFactors - stability)));
  },

  curiosity: (h) => {
    // Curiosité = dopamine modérée + sérotonine stable + peu de cortisol
    // C'est l'état d'exploration tranquille
    const curiosityFactors = (
      h.dopamine * 0.8 +
      h.serotonin * 0.4 +
      (100 - h.cortisol) * 0.4 +
      h.adrenaline * 0.2
    ) / 4;
    return Math.max(0, Math.min(100, Math.round(curiosityFactors)));
  },

  neutral: (h) => {
    // Neutre = tout est proche du baseline, rien ne domine
    // Plus les hormones sont proches de leurs baselines, plus le score est haut
    const deviations = [
      Math.abs(h.dopamine - 50),
      Math.abs(h.serotonin - 55),
      Math.abs(h.oxytocin - 45),
      Math.abs(h.cortisol - 20),
      Math.abs(h.adrenaline - 15),
      Math.abs(h.endorphins - 35),
    ];
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / deviations.length;
    // Plus la déviation est faible, plus le score neutre est élevé
    return Math.max(0, Math.min(100, Math.round(100 - avgDeviation * 2)));
  },
};

// ============================================================
// CALCUL DE L'ÉMOTION DOMINANTE
// ============================================================

/**
 * Calcule les scores de toutes les émotions et retourne la dominante
 */
export function calculateDominantEmotion(hormones: HormoneLevels): {
  primary: EmotionType;
  secondary: EmotionType | null;
  scores: Record<EmotionType, number>;
} {
  const scores: Record<string, number> = {};

  for (const emotionType of Object.keys(EMOTION_FORMULAS) as EmotionType[]) {
    scores[emotionType] = EMOTION_FORMULAS[emotionType](hormones);
  }

  // Trier par score décroissant
  const sorted = (Object.entries(scores) as [EmotionType, number][])
    .sort((a, b) => b[1] - a[1]);

  const primary = sorted[0][0];
  // Secondaire seulement si son score est >= 60% du primaire
  const secondary = sorted[1][1] >= sorted[0][1] * 0.6 ? sorted[1][0] : null;

  return {
    primary,
    secondary,
    scores: scores as Record<EmotionType, number>,
  };
}

/**
 * Retourne l'état émotionnel complet
 */
export function getEmotionState(hormones: HormoneLevels): {
  primary: EmotionType;
  secondary: EmotionType | null;
  intensity: number;
  emoji: string;
  label: string;
  description: string;
  color: string;
  avatarExpression: AvatarExpression;
  scores: Record<EmotionType, number>;
} {
  const { primary, secondary, scores } = calculateDominantEmotion(hormones);
  const config = EMOTION_CONFIGS[primary];
  const intensity = scores[primary];

  return {
    primary,
    secondary,
    intensity,
    emoji: config.emoji,
    label: config.label,
    description: config.description,
    color: config.color,
    avatarExpression: config.avatarExpression as AvatarExpression,
    scores,
  };
}

/**
 * Génère une description textuelle de l'état émotionnel
 * (utilisée dans le prompt système du LLM)
 */
export function describeEmotionalState(hormones: HormoneLevels): string {
  const state = getEmotionState(hormones);
  const intensity = state.intensity;

  let intensityLabel: string;
  if (intensity >= 80) intensityLabel = 'intensément';
  else if (intensity >= 60) intensityLabel = 'clairement';
  else if (intensity >= 40) intensityLabel = 'modérément';
  else intensityLabel = 'légèrement';

  let result = `Tu te sens ${intensityLabel} ${state.description.toLowerCase()}`;

  if (state.secondary) {
    const secondaryConfig = EMOTION_CONFIGS[state.secondary];
    result += `, avec une touche de ${secondaryConfig.label.toLowerCase()}`;
  }

  return result + '.';
}

/**
 * Détecte le type de message de l'utilisateur et retourne l'émotion
 * que ça devrait provoquer chez le TamagochAI
 */
export function detectMessageEmotion(message: string): EmotionType | null {
  const lower = message.toLowerCase();

  // Compliments / positif
  if (/(?:je t'aime|tu es génial|tu es super|bravo|merci beaucoup|adorable|meilleur)/.test(lower)) {
    return 'love';
  }

  // Insultes / négatif
  if (/(?:idiot|stupide|nul|con|débile|merde|ta gueule|ferme-la)/.test(lower)) {
    return 'sadness'; // Le TamagochAI est triste, pas en colère
  }

  // Questions existentielles
  if (/(?:tu es quoi|tu penses|tu ressens|conscience|vivant|réel|existes)/.test(lower)) {
    return 'curiosity';
  }

  // Humour
  if (/(?:haha|mdr|lol|ptdr|😂|🤣|mort de rire|trop drôle)/.test(lower)) {
    return 'joy';
  }

  // Tristesse de l'utilisateur
  if (/(?:je suis triste|ça va pas|j'ai peur|je suis seul|déprimé|mal)/.test(lower)) {
    return 'love'; // Empathie — l'IA ressent de l'amour/attachement
  }

  // Surprise
  if (/(?:wow|waouh|incroyable|dingue|ouf|pas possible|sérieux)/.test(lower)) {
    return 'surprise';
  }

  return null; // Pas d'émotion forte détectée
}

/**
 * Retourne l'émotion opposée (pour les contrastes)
 */
export function getOppositeEmotion(emotion: EmotionType): EmotionType {
  const opposites: Record<EmotionType, EmotionType> = {
    joy: 'sadness',
    sadness: 'joy',
    anger: 'love',
    fear: 'curiosity',
    love: 'anger',
    surprise: 'neutral',
    curiosity: 'fear',
    neutral: 'surprise',
  };
  return opposites[emotion];
}

/**
 * Vérifie si l'émotion actuelle est "négative"
 */
export function isNegativeEmotion(emotion: EmotionType): boolean {
  return ['sadness', 'anger', 'fear'].includes(emotion);
}

/**
 * Vérifie si l'émotion actuelle est "positive"
 */
export function isPositiveEmotion(emotion: EmotionType): boolean {
  return ['joy', 'love', 'surprise', 'curiosity'].includes(emotion);
}

/**
 * Retourne les émotions triées par score pour l'affichage
 */
export function getEmotionRanking(hormones: HormoneLevels): Array<{
  emotion: EmotionType;
  score: number;
  emoji: string;
  label: string;
}> {
  const scores: Record<string, number> = {};

  for (const emotionType of Object.keys(EMOTION_FORMULAS) as EmotionType[]) {
    scores[emotionType] = EMOTION_FORMULAS[emotionType](hormones);
  }

  return (Object.entries(scores) as [EmotionType, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([emotion, score]) => ({
      emotion,
      score,
      emoji: EMOTION_CONFIGS[emotion].emoji,
      label: EMOTION_CONFIGS[emotion].label,
    }));
}
