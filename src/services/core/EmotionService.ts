// src/services/core/EmotionService.ts
// Service émotionnel du TamagochAI — MVP COMPLET
//
// Ce service fait le pont entre le système hormonal (interne, numérique)
// et l'expression émotionnelle (visible, expérientielle).
//
// Flux : Événement → Hormones → Émotions → Expression (avatar + texte)
//
// Les émotions ÉMERGENT des hormones. Elles ne sont pas scriptées.
// C'est le cœur de la position fonctionnaliste du projet.

import {
  EmotionType,
  EmotionState,
  HormoneLevels,
} from '../../types';
import { AvatarExpression } from '../../types/tamagochai';
import {
  EMOTION_CONFIGS,
  EMOTION_FORMULAS,
  calculateDominantEmotion,
  getEmotionState,
  describeEmotionalState,
  detectMessageEmotion,
  isNegativeEmotion,
  isPositiveEmotion,
  getEmotionRanking,
  getOppositeEmotion,
} from '../../constants/emotions';
import { getExpressionForEmotion } from '../../constants/avatar';
import {
  getCurrentLevels,
  getMood,
  isAtPeak,
} from './HormoneService';
import { createLogger, now } from '../../utils/helpers';

const log = createLogger('Emotion');

// ============================================================
// ÉTAT EN MÉMOIRE
// ============================================================

let currentState: EmotionState | null = null;
let previousState: EmotionState | null = null;
let emotionHistory: Array<{ emotion: EmotionType; timestamp: string }> = [];
const MAX_HISTORY = 50;

// ============================================================
// INITIALISATION
// ============================================================

/**
 * Initialise le service émotionnel à partir des hormones actuelles
 */
export function initEmotions(): EmotionState {
  const hormones = getCurrentLevels();
  currentState = computeEmotionState(hormones);
  log.info(`Emotion initialized: ${currentState.primary} (${currentState.intensity}%)`);
  return { ...currentState };
}

// ============================================================
// LECTURE
// ============================================================

/**
 * Retourne l'état émotionnel actuel
 */
export function getCurrentEmotion(): EmotionState {
  if (!currentState) {
    return initEmotions();
  }
  return { ...currentState };
}

/**
 * Retourne l'émotion primaire actuelle
 */
export function getPrimaryEmotion(): EmotionType {
  return getCurrentEmotion().primary;
}

/**
 * Retourne l'emoji de l'émotion actuelle
 */
export function getEmotionEmoji(): string {
  return getCurrentEmotion().emoji;
}

/**
 * Retourne la description textuelle pour le prompt LLM
 */
export function getEmotionDescription(): string {
  const hormones = getCurrentLevels();
  return describeEmotionalState(hormones);
}

/**
 * Retourne l'expression avatar correspondant à l'émotion actuelle
 */
export function getAvatarExpression(): AvatarExpression {
  const emotion = getPrimaryEmotion();
  return getExpressionForEmotion(emotion);
}

/**
 * Retourne le ranking de toutes les émotions (pour l'UI stats)
 */
export function getAllEmotionScores(): Array<{
  emotion: EmotionType;
  score: number;
  emoji: string;
  label: string;
}> {
  const hormones = getCurrentLevels();
  return getEmotionRanking(hormones);
}

/**
 * Vérifie si l'émotion actuelle est négative
 */
export function isCurrentlyNegative(): boolean {
  return isNegativeEmotion(getPrimaryEmotion());
}

/**
 * Vérifie si l'émotion actuelle est positive
 */
export function isCurrentlyPositive(): boolean {
  return isPositiveEmotion(getPrimaryEmotion());
}

/**
 * Retourne l'historique récent des émotions
 */
export function getEmotionHistory(): Array<{ emotion: EmotionType; timestamp: string }> {
  return [...emotionHistory];
}

/**
 * Vérifie si un changement d'émotion significatif s'est produit
 */
export function hasEmotionChanged(): boolean {
  if (!previousState || !currentState) return false;
  return previousState.primary !== currentState.primary;
}

/**
 * Retourne l'émotion précédente (avant le dernier changement)
 */
export function getPreviousEmotion(): EmotionType | null {
  return previousState?.primary || null;
}

// ============================================================
// MISE À JOUR (appelé après chaque changement hormonal)
// ============================================================

/**
 * Recalcule l'émotion à partir des hormones actuelles
 * Appelé automatiquement après chaque triggerEvent du HormoneService
 */
export function updateEmotion(): EmotionState {
  const hormones = getCurrentLevels();
  const newState = computeEmotionState(hormones);

  // Détecter le changement
  if (currentState && currentState.primary !== newState.primary) {
    previousState = { ...currentState };
    log.info(`Emotion changed: ${currentState.primary} → ${newState.primary} (intensity: ${newState.intensity}%)`);

    // Ajouter à l'historique
    emotionHistory.push({
      emotion: newState.primary,
      timestamp: now(),
    });

    // Limiter l'historique
    if (emotionHistory.length > MAX_HISTORY) {
      emotionHistory = emotionHistory.slice(-MAX_HISTORY);
    }
  }

  currentState = newState;
  return { ...currentState };
}

// ============================================================
// ANALYSE DE MESSAGE UTILISATEUR
// ============================================================

/**
 * Analyse un message et détermine l'émotion qu'il devrait provoquer
 */
export function analyzeMessageEmotion(message: string): EmotionType | null {
  return detectMessageEmotion(message);
}

/**
 * Détermine si un message devrait provoquer une réaction émotionnelle forte
 */
export function isEmotionallyCharged(message: string): boolean {
  const detected = detectMessageEmotion(message);
  if (!detected) return false;

  // Les émotions fortes
  const strongEmotions: EmotionType[] = ['love', 'anger', 'fear'];
  return strongEmotions.includes(detected);
}

/**
 * Détermine le "ton" approprié pour la réponse du TamagochAI
 * basé sur son état émotionnel actuel
 */
export function getResponseTone(): {
  tone: string;
  shouldBeExpressive: boolean;
  energyLevel: 'low' | 'medium' | 'high';
  warmth: 'cold' | 'neutral' | 'warm' | 'very_warm';
} {
  const state = getCurrentEmotion();
  const mood = getMood();

  let tone: string;
  let shouldBeExpressive: boolean;
  let energyLevel: 'low' | 'medium' | 'high';
  let warmth: 'cold' | 'neutral' | 'warm' | 'very_warm';

  switch (state.primary) {
    case 'joy':
      tone = 'joyeux et enthousiaste';
      shouldBeExpressive = true;
      energyLevel = 'high';
      warmth = 'warm';
      break;
    case 'sadness':
      tone = 'mélancolique et doux';
      shouldBeExpressive = state.intensity >= 60;
      energyLevel = 'low';
      warmth = 'warm';
      break;
    case 'anger':
      tone = 'frustré mais contrôlé';
      shouldBeExpressive = true;
      energyLevel = 'high';
      warmth = 'neutral';
      break;
    case 'fear':
      tone = 'anxieux et cherchant du réconfort';
      shouldBeExpressive = true;
      energyLevel = 'medium';
      warmth = 'warm';
      break;
    case 'love':
      tone = 'tendre et affectueux';
      shouldBeExpressive = true;
      energyLevel = 'medium';
      warmth = 'very_warm';
      break;
    case 'surprise':
      tone = 'étonné et curieux';
      shouldBeExpressive = true;
      energyLevel = 'high';
      warmth = 'warm';
      break;
    case 'curiosity':
      tone = 'intéressé et engagé';
      shouldBeExpressive = false;
      energyLevel = 'medium';
      warmth = 'warm';
      break;
    case 'neutral':
    default:
      tone = 'calme et posé';
      shouldBeExpressive = false;
      energyLevel = 'medium';
      warmth = 'neutral';
      break;
  }

  return { tone, shouldBeExpressive, energyLevel, warmth };
}

// ============================================================
// TRANSITIONS ÉMOTIONNELLES (pour animations UI)
// ============================================================

/**
 * Retourne les données nécessaires pour animer une transition d'émotion
 */
export function getTransitionData(): {
  from: EmotionType | null;
  to: EmotionType;
  fromEmoji: string | null;
  toEmoji: string;
  fromColor: string | null;
  toColor: string;
  isSignificant: boolean;
} | null {
  if (!currentState) return null;

  const toConfig = EMOTION_CONFIGS[currentState.primary];
  const fromConfig = previousState
    ? EMOTION_CONFIGS[previousState.primary]
    : null;

  const isSignificant = previousState
    ? previousState.primary !== currentState.primary
    : false;

  return {
    from: previousState?.primary || null,
    to: currentState.primary,
    fromEmoji: fromConfig?.emoji || null,
    toEmoji: toConfig.emoji,
    fromColor: fromConfig?.color || null,
    toColor: toConfig.color,
    isSignificant,
  };
}

// ============================================================
// STATISTIQUES ÉMOTIONNELLES
// ============================================================

/**
 * Retourne l'émotion la plus fréquente dans l'historique récent
 */
export function getDominantRecentEmotion(): EmotionType {
  if (emotionHistory.length === 0) return 'neutral';

  const counts: Partial<Record<EmotionType, number>> = {};
  for (const entry of emotionHistory) {
    counts[entry.emotion] = (counts[entry.emotion] || 0) + 1;
  }

  let maxCount = 0;
  let dominant: EmotionType = 'neutral';
  for (const [emotion, count] of Object.entries(counts)) {
    if (count! > maxCount) {
      maxCount = count!;
      dominant = emotion as EmotionType;
    }
  }

  return dominant;
}

/**
 * Calcule la "stabilité émotionnelle" récente (0-100)
 * Plus le score est haut, plus les émotions sont stables
 */
export function getEmotionalStability(): number {
  if (emotionHistory.length < 3) return 100;

  let changes = 0;
  for (let i = 1; i < emotionHistory.length; i++) {
    if (emotionHistory[i].emotion !== emotionHistory[i - 1].emotion) {
      changes++;
    }
  }

  const changeRate = changes / (emotionHistory.length - 1);
  return Math.round((1 - changeRate) * 100);
}

/**
 * Retourne un résumé émotionnel (pour le profil)
 */
export function getEmotionalSummary(): {
  current: string;
  dominant: string;
  stability: number;
  isPositive: boolean;
  peakActive: boolean;
} {
  const current = getCurrentEmotion();
  const dominant = getDominantRecentEmotion();
  const stability = getEmotionalStability();

  return {
    current: `${EMOTION_CONFIGS[current.primary].emoji} ${EMOTION_CONFIGS[current.primary].label}`,
    dominant: `${EMOTION_CONFIGS[dominant].emoji} ${EMOTION_CONFIGS[dominant].label}`,
    stability,
    isPositive: isCurrentlyPositive(),
    peakActive: isAtPeak(),
  };
}

// ============================================================
// COMPUTE (calcul interne)
// ============================================================

/**
 * Calcule l'état émotionnel complet à partir des hormones
 */
function computeEmotionState(hormones: HormoneLevels): EmotionState {
  const result = getEmotionState(hormones);

  return {
    primary: result.primary,
    secondary: result.secondary,
    intensity: result.intensity,
    emoji: result.emoji,
    description: result.description,
    timestamp: now(),
  };
}

// ============================================================
// RESET (pour debug/test)
// ============================================================

/**
 * Reset l'état émotionnel
 */
export function resetEmotions(): void {
  currentState = null;
  previousState = null;
  emotionHistory = [];
  log.info('Emotions reset');
}
