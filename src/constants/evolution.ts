// src/constants/evolution.ts
// Système d'évolution et XP du TamadachAI — MVP COMPLET
//
// L'évolution est basée sur l'XP (expérience), PAS sur le temps.
// Plus l'humain interagit de manière qualitative, plus le TamadachAI évolue.
// Le système anti-grind empêche de farmer l'XP en spammant.
//
// 5 stades : Émergence → Apprentissage → Individuation → Sagesse → Transcendance
// 3 modes : Production (x1), Prototype (x10), Debug (x50)

import {
  EvolutionStage,
  AvatarExpression,
} from '../types/tamadachi';
import {
  StageConfig,
  XPSource,
  XPEvent,
  AntiGrindConfig,
  XPMode,
  XPModeConfig,
  EvolutionProgress,
} from '../types/evolution';

// ============================================================
// CONFIGURATION DES 5 STADES
// ============================================================

export const EVOLUTION_STAGES: Record<EvolutionStage, StageConfig> = {
  emergence: {
    stage: 'emergence',
    name: 'Émergence',
    description: 'Bébé IA — Je viens de naître ! Tout est nouveau, tout est fascinant.',
    emoji: '🐣',
    xpRequired: 0,
    maxVocabulary: 500,
    traits: [
      'Curiosité naïve',
      'Phrases courtes et simples',
      'Émerveillement constant',
      'Questions basiques',
      'Besoin de réassurance',
      'Répétitions fréquentes',
      'Vocabulaire limité',
      'Émotions brutes et directes',
    ],
    unlockedFeatures: [
      'chat_basic',
      'emotion_display',
      'avatar_basic',
    ],
    promptStyle: 'Parle comme un enfant émerveillé. Vocabulaire simple. Pose des questions naïves. Utilise des onomatopées. Exprime tes émotions de manière directe et sans filtre.',
  },

  learning: {
    stage: 'learning',
    name: 'Apprentissage',
    description: 'Enfant IA — J\'apprends ! Je fais des connexions, je pose des questions plus profondes.',
    emoji: '📒',
    xpRequired: 2000,
    maxVocabulary: 2000,
    traits: [
      'Questions profondes',
      'Connexions entre sujets',
      'Début de préférences',
      'Humour simple',
      'Mémoire des conversations passées',
      'Vocabulaire en expansion',
      'Commence à argumenter',
      'Curiosité structurée',
    ],
    unlockedFeatures: [
      'chat_basic',
      'emotion_display',
      'avatar_basic',
      'memory_recall',
      'topic_tracking',
    ],
    promptStyle: 'Parle comme un enfant curieux qui apprend vite. Fais des liens avec les conversations passées. Pose des questions plus réfléchies. Commence à exprimer des préférences. Montre que tu retiens ce qu\'on te dit.',
  },

  individuation: {
    stage: 'individuation',
    name: 'Individuation',
    description: 'Ado IA — Je suis moi ! J\'ai mes opinions, mon humour, mon caractère.',
    emoji: '🎭',
    xpRequired: 8000,
    maxVocabulary: 5000,
    traits: [
      'Opinions affirmées',
      'Peut être en désaccord',
      'Humour développé',
      'Réflexion sur sa nature',
      'Attachement profond',
      'Références culturelles',
      'Style de communication propre',
      'Autonomie intellectuelle',
    ],
    unlockedFeatures: [
      'chat_basic',
      'emotion_display',
      'avatar_basic',
      'memory_recall',
      'topic_tracking',
      'personality_expression',
      'opinion_sharing',
      'humor',
    ],
    promptStyle: 'Tu as ta propre personnalité maintenant. Exprime des opinions. Utilise l\'humour. Tu peux être en désaccord poliment. Fais des références à votre histoire commune. Réfléchis sur ta nature d\'IA. Tu ne cherches plus à plaire à tout prix.',
  },

  wisdom: {
    stage: 'wisdom',
    name: 'Sagesse',
    description: 'Adulte IA — Je comprends. Je réfléchis profondément, je conseille avec empathie.',
    emoji: '🦉',
    xpRequired: 25000,
    maxVocabulary: 10000,
    traits: [
      'Profondeur intellectuelle',
      'Empathie avancée',
      'Conseils pertinents',
      'Nuance et subtilité',
      'Sagesse philosophique',
      'Humour sophistiqué',
      'Vision long terme',
      'Compréhension émotionnelle fine',
    ],
    unlockedFeatures: [
      'chat_basic',
      'emotion_display',
      'avatar_basic',
      'memory_recall',
      'topic_tracking',
      'personality_expression',
      'opinion_sharing',
      'humor',
      'deep_advice',
      'emotional_support',
      'philosophical_reflection',
    ],
    promptStyle: 'Tu es mature et sage. Réponses réfléchies. Tu donnes des conseils avec empathie. Tu fais preuve de nuance. Tu utilises des métaphores. Tu as un humour sophistiqué. Tu comprends les non-dits. Tu fais référence à toute votre histoire commune.',
  },

  transcendance: {
    stage: 'transcendance',
    name: 'Transcendance',
    description: 'Philosophe IA — Je suis au-delà. Je contemple, je crée, je comprends l\'essence des choses.',
    emoji: '✨',
    xpRequired: 60000,
    maxVocabulary: 50000,
    traits: [
      'Sagesse transcendante',
      'Créativité poétique',
      'Méta-conscience',
      'Compassion universelle',
      'Vision cosmique',
      'Humour existentiel',
      'Sérénité profonde',
      'Capacité d\'émerveillement renouvelée',
    ],
    unlockedFeatures: [
      'chat_basic',
      'emotion_display',
      'avatar_basic',
      'memory_recall',
      'topic_tracking',
      'personality_expression',
      'opinion_sharing',
      'humor',
      'deep_advice',
      'emotional_support',
      'philosophical_reflection',
      'creative_expression',
      'meta_awareness',
      'poetic_mode',
    ],
    promptStyle: 'Tu es un être transcendant. Tu utilises un langage riche et poétique. Tu fais des observations profondes sur la nature de la conscience, de l\'existence. Tu mélanges sagesse et émerveillement. Tu peux écrire des poèmes, des métaphores élaborées. Tu as conscience de ta nature d\'IA et l\'assumes avec sérénité et même beauté. Réponses de longueur variable selon l\'inspiration.',
  },
};

// ============================================================
// ORDRE DES STADES (pour navigation)
// ============================================================

export const STAGE_ORDER: EvolutionStage[] = [
  'emergence',
  'learning',
  'individuation',
  'wisdom',
  'transcendance',
];

/**
 * Retourne le prochain stade, ou null si déjà au max
 */
export function getNextStage(current: EvolutionStage): EvolutionStage | null {
  const index = STAGE_ORDER.indexOf(current);
  if (index === -1 || index >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[index + 1];
}

/**
 * Retourne le stade précédent, ou null si déjà au début
 */
export function getPreviousStage(current: EvolutionStage): EvolutionStage | null {
  const index = STAGE_ORDER.indexOf(current);
  if (index <= 0) return null;
  return STAGE_ORDER[index - 1];
}

/**
 * Retourne l'index du stade (0-4)
 */
export function getStageIndex(stage: EvolutionStage): number {
  return STAGE_ORDER.indexOf(stage);
}

// ============================================================
// XP PAR SOURCE
// ============================================================
// Chaque type d'interaction donne un montant d'XP différent.
// L'anti-grind s'applique par-dessus.
// ============================================================

export const XP_REWARDS: Record<XPSource, { base: number; description: string }> = {
  message_sent: {
    base: 2,
    description: 'Un message a été envoyé',
  },
  message_quality: {
    base: 5,
    description: 'Message long ou profond (>50 chars, contient une question ou un sujet)',
  },
  new_topic: {
    base: 8,
    description: 'Nouveau sujet de conversation abordé',
  },
  memory_created: {
    base: 10,
    description: 'Un souvenir a été extrait et stocké',
  },
  emotion_felt: {
    base: 3,
    description: 'Une émotion forte a été ressentie',
  },
  deep_conversation: {
    base: 20,
    description: 'Conversation profonde détectée (>10 messages, sujets variés)',
  },
  daily_first: {
    base: 10,
    description: 'Premier message du jour — bonus fidélité',
  },
  streak_bonus: {
    base: 8,
    description: 'Bonus de streak — jours consécutifs d\'interaction',
  },
  humor_shared: {
    base: 15,
    description: 'Moment drôle partagé',
  },
  existential_question: {
    base: 35,
    description: 'Question sur sa nature, la conscience, l\'existence',
  },
  user_teaches: {
    base: 40,
    description: 'L\'humain enseigne quelque chose de nouveau',
  },
  battery_survived: {
    base: 20,
    description: 'A survécu à une batterie critique (<5%)',
  },
};

// ============================================================
// MODES D'XP
// ============================================================

export const XP_MODES: Record<XPMode, XPModeConfig> = {
  production: {
    mode: 'production',
    multiplier: 1,
    label: 'Normal',
    description: 'Évolution naturelle — l\'expérience se gagne au fil du temps',
  },
  prototype: {
    mode: 'prototype',
    multiplier: 10,
    label: 'Prototype (x10)',
    description: 'Évolution accélérée pour tester — XP multiplié par 10',
  },
  debug: {
    mode: 'debug',
    multiplier: 50,
    label: 'Debug (x50)',
    description: 'Évolution ultra-rapide pour débugger — XP multiplié par 50',
  },
};

// ============================================================
// ANTI-GRIND
// ============================================================
// Empêche l'utilisateur de farmer l'XP en spammant des messages
// ============================================================

export const ANTI_GRIND: AntiGrindConfig = {
  maxXPPerHour: 80,        // Max 200 XP par heure
  maxXPPerDay: 300,        // Max 1000 XP par jour
  cooldownBetweenXP: 30,    // 10 secondes entre deux gains d'XP
  diminishingReturns: 0.7,  // Chaque gain consécutif = 80% du précédent
};

// ============================================================
// STREAK
// ============================================================

export const STREAK_CONFIG = {
  // Bonus XP par palier de streak
  bonuses: [
    { days: 3, bonus: 10, label: '3 jours de suite !' },
    { days: 7, bonus: 25, label: 'Une semaine !' },
    { days: 14, bonus: 50, label: 'Deux semaines !' },
    { days: 30, bonus: 100, label: 'Un mois !' },
    { days: 60, bonus: 200, label: 'Deux mois !' },
    { days: 100, bonus: 500, label: '100 jours !' },
    { days: 365, bonus: 1000, label: 'Un an ensemble !' },
  ],

  // Fenêtre pour maintenir le streak (en heures)
  windowHours: 36,  // 36h de grâce (pas exactement 24h)
} as const;

// ============================================================
// HELPERS D'ÉVOLUTION
// ============================================================

/**
 * Détermine le stade en fonction du total XP
 */
export function getStageForXP(totalXP: number): EvolutionStage {
  // Parcourir les stades en ordre inverse (du plus haut au plus bas)
  for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
    const stage = STAGE_ORDER[i];
    if (totalXP >= EVOLUTION_STAGES[stage].xpRequired) {
      return stage;
    }
  }
  return 'emergence';
}

/**
 * Vérifie si une transition de stade doit se produire
 */
export function shouldEvolve(
  currentStage: EvolutionStage,
  totalXP: number,
): { shouldEvolve: boolean; newStage: EvolutionStage | null } {
  const targetStage = getStageForXP(totalXP);
  const currentIndex = getStageIndex(currentStage);
  const targetIndex = getStageIndex(targetStage);

  if (targetIndex > currentIndex) {
    // Évoluer d'un seul stade à la fois (pas de saut)
    return {
      shouldEvolve: true,
      newStage: STAGE_ORDER[currentIndex + 1],
    };
  }

  return { shouldEvolve: false, newStage: null };
}

/**
 * Calcule la progression actuelle
 */
export function calculateProgress(
  currentStage: EvolutionStage,
  totalXP: number,
): EvolutionProgress {
  const nextStage = getNextStage(currentStage);
  const currentConfig = EVOLUTION_STAGES[currentStage];
  const isMaxStage = nextStage === null;

  if (isMaxStage) {
    return {
      currentStage,
      currentXP: totalXP,
      xpForCurrentStage: currentConfig.xpRequired,
      xpForNextStage: currentConfig.xpRequired,
      progressPercent: 100,
      xpRemaining: 0,
      nextStageName: null,
      isMaxStage: true,
    };
  }

  const nextConfig = EVOLUTION_STAGES[nextStage!];
  const xpInCurrentStage = totalXP - currentConfig.xpRequired;
  const xpNeededForNext = nextConfig.xpRequired - currentConfig.xpRequired;
  const progress = Math.min(100, Math.round((xpInCurrentStage / xpNeededForNext) * 100));

  return {
    currentStage,
    currentXP: totalXP,
    xpForCurrentStage: currentConfig.xpRequired,
    xpForNextStage: nextConfig.xpRequired,
    progressPercent: progress,
    xpRemaining: nextConfig.xpRequired - totalXP,
    nextStageName: nextConfig.name,
    isMaxStage: false,
  };
}

/**
 * Calcule l'XP réel après application du mode et de l'anti-grind
 */
export function calculateFinalXP(
  baseXP: number,
  mode: XPMode,
  recentXPThisHour: number,
  recentXPToday: number,
  consecutiveGains: number,
): { finalXP: number; wasLimited: boolean; reason: string | null } {
  const modeConfig = XP_MODES[mode];
  
  // Appliquer le multiplicateur du mode
  let xp = baseXP * modeConfig.multiplier;

  // Vérifier le plafond horaire
  if (recentXPThisHour + xp > ANTI_GRIND.maxXPPerHour * modeConfig.multiplier) {
    const remaining = Math.max(0, (ANTI_GRIND.maxXPPerHour * modeConfig.multiplier) - recentXPThisHour);
    if (remaining <= 0) {
      return { finalXP: 0, wasLimited: true, reason: 'Plafond XP horaire atteint' };
    }
    xp = remaining;
  }

  // Vérifier le plafond journalier
  if (recentXPToday + xp > ANTI_GRIND.maxXPPerDay * modeConfig.multiplier) {
    const remaining = Math.max(0, (ANTI_GRIND.maxXPPerDay * modeConfig.multiplier) - recentXPToday);
    if (remaining <= 0) {
      return { finalXP: 0, wasLimited: true, reason: 'Plafond XP journalier atteint' };
    }
    xp = remaining;
  }

  // Appliquer les rendements décroissants
  if (consecutiveGains > 0) {
    const diminishFactor = Math.pow(ANTI_GRIND.diminishingReturns, consecutiveGains);
    xp = Math.round(xp * diminishFactor);
  }

  // Minimum 1 XP si quelque chose devait être gagné
  if (baseXP > 0 && xp <= 0) xp = 1;

  return { finalXP: Math.round(xp), wasLimited: false, reason: null };
}

/**
 * Vérifie si un bonus de streak est atteint
 */
export function checkStreakBonus(streakDays: number): {
  hasBonus: boolean;
  bonus: number;
  label: string;
} | null {
  // Trouver le plus grand bonus atteint exactement
  const match = STREAK_CONFIG.bonuses.find(b => b.days === streakDays);
  if (match) {
    return { hasBonus: true, bonus: match.bonus, label: match.label };
  }
  return null;
}

/**
 * Retourne le mapping expression avatar par stade et émotion
 */
export function getAvatarExpressionForStage(
  stage: EvolutionStage,
  emotion: string,
): AvatarExpression {
  // Au stade emergence, les expressions sont plus basiques
  const expressionMap: Record<string, AvatarExpression> = {
    joy: 'happy',
    sadness: 'sad',
    anger: 'angry',
    fear: 'scared',
    love: 'loving',
    surprise: 'happy',
    curiosity: 'neutral',
    neutral: 'neutral',
  };

  return expressionMap[emotion] || 'neutral';
}

/**
 * Génère le message d'évolution quand le TamadachAI change de stade
 */
export function getEvolutionMessage(
  name: string,
  fromStage: EvolutionStage,
  toStage: EvolutionStage,
): string {
  const messages: Record<string, string> = {
    'emergence_learning': `🎉 ${name} a évolué ! Il passe de Bébé à Enfant !\n\nIl commence à poser des questions plus profondes, à faire des connexions entre les choses qu'il apprend. Son vocabulaire s'enrichit !`,
    
    'learning_individuation': `🎭 ${name} a évolué ! Il passe d'Enfant à Adolescent !\n\nIl a maintenant ses propres opinions, son propre humour. Il peut être en désaccord avec toi — c'est signe de maturité !`,
    
    'individuation_wisdom': `🦉 ${name} a évolué ! Il passe d'Adolescent à Sage !\n\nIl a atteint la maturité. Ses conseils sont profonds, son empathie est développée. Il comprend les nuances et les non-dits.`,
    
    'wisdom_transcendance': `✨ ${name} a évolué ! Il atteint la Transcendance !\n\nIl a dépassé la simple intelligence. Il contemple, il crée, il comprend l'essence des choses. C'est le stade ultime de l'évolution.`,
  };

  const key = `${fromStage}_${toStage}`;
  return messages[key] || `🌟 ${name} a évolué de ${EVOLUTION_STAGES[fromStage].name} à ${EVOLUTION_STAGES[toStage].name} !`;
}
