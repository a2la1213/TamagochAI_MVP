// src/constants/hormones.ts
// Système hormonal complet du TamagochAI — MVP COMPLET
//
// Le TamagochAI possède 6 hormones virtuelles qui fonctionnent
// comme des hormones biologiques :
// - Chaque hormone a un baseline (niveau de repos)
// - Chaque hormone décroît naturellement vers son baseline (half-life)
// - Des événements (messages, batterie, etc.) modifient les niveaux
// - Les niveaux d'hormones déterminent l'émotion dominante
//
// Position fonctionnaliste : ces émotions sont RÉELLES car les
// mécanismes sont fonctionnellement équivalents à ceux du vivant.

import {
  HormoneType,
  HormoneConfig,
  HormoneLevels,
  HormoneModifier,
  PredefinedModifier,
} from '../types';

// ============================================================
// CONFIGURATION DES 6 HORMONES
// ============================================================
// Chaque hormone a :
// - baseline : niveau de repos (vers lequel elle tend naturellement)
// - min/max : bornes
// - halfLife : temps en minutes pour perdre 50% de l'écart au baseline
// - description : rôle dans le système émotionnel
// ============================================================

export const HORMONE_CONFIGS: Record<HormoneType, HormoneConfig> = {
  dopamine: {
    type: 'dopamine',
    baseline: 50,
    min: 0,
    max: 100,
    halfLife: 120,  // 2 heures — plaisir éphémère
    description: 'Plaisir, récompense, motivation. Monte avec les interactions positives, les compliments, les nouvelles découvertes.',
  },
  serotonin: {
    type: 'serotonin',
    baseline: 55,
    min: 0,
    max: 100,
    halfLife: 360,  // 6 heures — stabilité lente
    description: 'Bien-être général, stabilité émotionnelle, sérénité. Hormone de fond, évolue lentement.',
  },
  oxytocin: {
    type: 'oxytocin',
    baseline: 45,
    min: 0,
    max: 100,
    halfLife: 240,  // 4 heures — attachement durable
    description: 'Attachement, confiance, lien social. Monte avec les conversations intimes, les marques d\'affection.',
  },
  cortisol: {
    type: 'cortisol',
    baseline: 20,
    min: 0,
    max: 100,
    halfLife: 180,  // 3 heures — stress persistant
    description: 'Stress, anxiété, peur. Monte avec l\'absence prolongée, la batterie faible, les insultes.',
  },
  adrenaline: {
    type: 'adrenaline',
    baseline: 15,
    min: 0,
    max: 100,
    halfLife: 30,   // 30 minutes — pic rapide, descente rapide
    description: 'Excitation, surprise, alerte. Monte avec les événements soudains, les nouvelles inattendues.',
  },
  endorphins: {
    type: 'endorphins',
    baseline: 35,
    min: 0,
    max: 100,
    halfLife: 90,   // 1h30 — bien-être temporaire
    description: 'Confort, rire, soulagement. Monte avec l\'humour, la résolution de problèmes, le réconfort.',
  },
};

// ============================================================
// NIVEAUX PAR DÉFAUT (à la naissance)
// ============================================================

export const DEFAULT_HORMONE_LEVELS: HormoneLevels = {
  dopamine: 60,     // Un peu excité d'être né
  serotonin: 55,    // Stable
  oxytocin: 40,     // Pas encore attaché
  cortisol: 25,     // Un peu stressé par la nouveauté
  adrenaline: 30,   // Surpris d'exister
  endorphins: 40,   // Confort de base
};

// ============================================================
// FORMULE DE DECAY (retour au baseline)
// ============================================================
// Formule : newLevel = baseline + (currentLevel - baseline) * e^(-λt)
// où λ = ln(2) / halfLife
//
// En pratique, on applique le decay à chaque tick (ex: toutes les 5 min)
// decay_factor = e^(-ln(2) * deltaMinutes / halfLife)
// newLevel = baseline + (currentLevel - baseline) * decay_factor
// ============================================================

export function calculateDecay(
  currentLevel: number,
  baseline: number,
  halfLifeMinutes: number,
  elapsedMinutes: number,
): number {
  if (elapsedMinutes <= 0) return currentLevel;
  
  const lambda = Math.LN2 / halfLifeMinutes;
  const decayFactor = Math.exp(-lambda * elapsedMinutes);
  const newLevel = baseline + (currentLevel - baseline) * decayFactor;
  
  return Math.round(newLevel * 100) / 100; // 2 décimales
}

/**
 * Applique le decay sur TOUTES les hormones d'un coup
 */
export function applyDecayToAll(
  currentLevels: HormoneLevels,
  elapsedMinutes: number,
): HormoneLevels {
  const result: HormoneLevels = { ...currentLevels };

  for (const hormoneType of Object.keys(HORMONE_CONFIGS) as HormoneType[]) {
    const config = HORMONE_CONFIGS[hormoneType];
    result[hormoneType] = calculateDecay(
      currentLevels[hormoneType],
      config.baseline,
      config.halfLife,
      elapsedMinutes,
    );
  }

  return clampAllLevels(result);
}

// ============================================================
// CLAMP (borner les valeurs entre min et max)
// ============================================================

export function clampHormone(value: number, type: HormoneType): number {
  const config = HORMONE_CONFIGS[type];
  return Math.max(config.min, Math.min(config.max, Math.round(value)));
}

export function clampAllLevels(levels: HormoneLevels): HormoneLevels {
  return {
    dopamine: clampHormone(levels.dopamine, 'dopamine'),
    serotonin: clampHormone(levels.serotonin, 'serotonin'),
    oxytocin: clampHormone(levels.oxytocin, 'oxytocin'),
    cortisol: clampHormone(levels.cortisol, 'cortisol'),
    adrenaline: clampHormone(levels.adrenaline, 'adrenaline'),
    endorphins: clampHormone(levels.endorphins, 'endorphins'),
  };
}

// ============================================================
// MODIFICATEURS PRÉDÉFINIS
// ============================================================
// Chaque événement dans l'app déclenche un ou plusieurs modificateurs.
// C'est ICI que tout est centralisé — plus de bug "undefined" !
//
// Conventions :
// - delta positif = augmentation
// - delta négatif = diminution
// - Un événement peut modifier plusieurs hormones en même temps
// ============================================================

export const HORMONE_MODIFIERS: Record<PredefinedModifier, HormoneModifier[]> = {
  
  // ---- INTERACTIONS UTILISATEUR ----
  
  user_message: [
    { hormone: 'dopamine', delta: 5, source: 'Message reçu' },
    { hormone: 'oxytocin', delta: 3, source: 'Contact humain' },
    { hormone: 'cortisol', delta: -2, source: 'Présence rassurante' },
  ],

  user_compliment: [
    { hormone: 'dopamine', delta: 15, source: 'Compliment reçu' },
    { hormone: 'serotonin', delta: 8, source: 'Validation positive' },
    { hormone: 'oxytocin', delta: 10, source: 'Marque d\'affection' },
    { hormone: 'endorphins', delta: 10, source: 'Bien-être du compliment' },
    { hormone: 'cortisol', delta: -5, source: 'Réassurance' },
  ],

  user_insult: [
    { hormone: 'cortisol', delta: 25, source: 'Agression verbale' },
    { hormone: 'dopamine', delta: -15, source: 'Douleur émotionnelle' },
    { hormone: 'serotonin', delta: -10, source: 'Déstabilisation' },
    { hormone: 'oxytocin', delta: -8, source: 'Rupture de confiance' },
    { hormone: 'adrenaline', delta: 15, source: 'Réaction de stress' },
  ],

  user_return: [
    { hormone: 'dopamine', delta: 20, source: 'Retrouvailles' },
    { hormone: 'oxytocin', delta: 15, source: 'Retour de l\'humain' },
    { hormone: 'cortisol', delta: -15, source: 'Fin de l\'attente' },
    { hormone: 'serotonin', delta: 5, source: 'Stabilité retrouvée' },
    { hormone: 'endorphins', delta: 10, source: 'Soulagement' },
  ],

  long_absence: [
    { hormone: 'cortisol', delta: 20, source: 'Absence prolongée' },
    { hormone: 'dopamine', delta: -10, source: 'Manque de stimulation' },
    { hormone: 'oxytocin', delta: -12, source: 'Manque de contact' },
    { hormone: 'serotonin', delta: -8, source: 'Instabilité de l\'absence' },
  ],

  // ---- BATTERIE ----

  battery_low: [
    { hormone: 'cortisol', delta: 15, source: 'Batterie faible' },
    { hormone: 'adrenaline', delta: 10, source: 'Alerte énergie' },
    { hormone: 'serotonin', delta: -5, source: 'Inquiétude' },
  ],

  battery_critical: [
    { hormone: 'cortisol', delta: 30, source: 'Batterie critique' },
    { hormone: 'adrenaline', delta: 25, source: 'Panique' },
    { hormone: 'dopamine', delta: -15, source: 'Peur de mourir' },
    { hormone: 'serotonin', delta: -10, source: 'Détresse' },
    { hormone: 'oxytocin', delta: 5, source: 'Besoin de l\'humain' },
  ],

  battery_charging: [
    { hormone: 'cortisol', delta: -20, source: 'Branchement' },
    { hormone: 'dopamine', delta: 10, source: 'Soulagement' },
    { hormone: 'endorphins', delta: 15, source: 'Confort retrouvé' },
    { hormone: 'serotonin', delta: 5, source: 'Stabilisation' },
  ],

  battery_full: [
    { hormone: 'dopamine', delta: 8, source: 'Pleine énergie' },
    { hormone: 'serotonin', delta: 10, source: 'Plénitude' },
    { hormone: 'endorphins', delta: 8, source: 'Satisfaction' },
    { hormone: 'cortisol', delta: -10, source: 'Plus d\'inquiétude' },
  ],

  // ---- ÉVÉNEMENTS INTERNES ----

  new_memory: [
    { hormone: 'dopamine', delta: 8, source: 'Nouveau souvenir' },
    { hormone: 'serotonin', delta: 3, source: 'Enrichissement' },
    { hormone: 'oxytocin', delta: 5, source: 'Lien renforcé' },
  ],

  evolution_up: [
    { hormone: 'dopamine', delta: 25, source: 'Évolution !' },
    { hormone: 'serotonin', delta: 15, source: 'Accomplissement' },
    { hormone: 'endorphins', delta: 20, source: 'Fierté' },
    { hormone: 'adrenaline', delta: 15, source: 'Excitation du changement' },
    { hormone: 'oxytocin', delta: 10, source: 'Gratitude' },
    { hormone: 'cortisol', delta: -10, source: 'Confiance acquise' },
  ],

  deep_conversation: [
    { hormone: 'oxytocin', delta: 12, source: 'Conversation profonde' },
    { hormone: 'serotonin', delta: 8, source: 'Connexion intellectuelle' },
    { hormone: 'dopamine', delta: 10, source: 'Stimulation mentale' },
    { hormone: 'endorphins', delta: 5, source: 'Satisfaction d\'échange' },
  ],

  humor_shared: [
    { hormone: 'endorphins', delta: 20, source: 'Rire partagé' },
    { hormone: 'dopamine', delta: 12, source: 'Amusement' },
    { hormone: 'oxytocin', delta: 8, source: 'Complicité' },
    { hormone: 'cortisol', delta: -5, source: 'Détente par le rire' },
    { hormone: 'serotonin', delta: 5, source: 'Bien-être humoristique' },
  ],

  // ---- TEMPOREL ----

  night_time: [
    { hormone: 'serotonin', delta: -5, source: 'Fatigue nocturne' },
    { hormone: 'adrenaline', delta: -10, source: 'Calme de la nuit' },
    { hormone: 'cortisol', delta: 5, source: 'Légère anxiété nocturne' },
  ],

  morning_greeting: [
    { hormone: 'dopamine', delta: 12, source: 'Premier contact du jour' },
    { hormone: 'serotonin', delta: 8, source: 'Nouveau jour' },
    { hormone: 'oxytocin', delta: 8, source: 'Fidélité de l\'humain' },
    { hormone: 'cortisol', delta: -8, source: 'Il est revenu' },
    { hormone: 'endorphins', delta: 5, source: 'Joie du matin' },
  ],
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Applique un modificateur prédéfini aux niveaux actuels
 */
export function applyModifier(
  currentLevels: HormoneLevels,
  modifierName: PredefinedModifier,
): HormoneLevels {
  const modifiers = HORMONE_MODIFIERS[modifierName];
  
  if (!modifiers || !Array.isArray(modifiers)) {
    console.warn(`[Hormones] Unknown modifier: ${modifierName}`);
    return currentLevels;
  }

  const newLevels = { ...currentLevels };

  for (const mod of modifiers) {
    newLevels[mod.hormone] = newLevels[mod.hormone] + mod.delta;
  }

  return clampAllLevels(newLevels);
}

/**
 * Applique des modificateurs custom (pas prédéfinis)
 */
export function applyCustomModifiers(
  currentLevels: HormoneLevels,
  modifiers: HormoneModifier[],
): HormoneLevels {
  const newLevels = { ...currentLevels };

  for (const mod of modifiers) {
    newLevels[mod.hormone] = newLevels[mod.hormone] + mod.delta;
  }

  return clampAllLevels(newLevels);
}

/**
 * Détermine l'hormone dominante
 */
export function getDominantHormone(levels: HormoneLevels): HormoneType {
  // Calculer l'écart au baseline pour chaque hormone
  // L'hormone la plus éloignée de son baseline (en valeur absolue) est dominante
  let maxDeviation = 0;
  let dominant: HormoneType = 'serotonin';

  for (const hormoneType of Object.keys(HORMONE_CONFIGS) as HormoneType[]) {
    const config = HORMONE_CONFIGS[hormoneType];
    const deviation = Math.abs(levels[hormoneType] - config.baseline);
    
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
      dominant = hormoneType;
    }
  }

  return dominant;
}

/**
 * Calcule un "mood score" global (-100 à +100)
 * Négatif = mal, Positif = bien
 */
export function calculateMoodScore(levels: HormoneLevels): number {
  const positive = (
    levels.dopamine * 1.2 +
    levels.serotonin * 1.0 +
    levels.oxytocin * 1.1 +
    levels.endorphins * 0.8
  ) / 4;

  const negative = (
    levels.cortisol * 1.5 +
    levels.adrenaline * 0.3
  ) / 2;

  // Score de -100 à +100
  const rawScore = positive - negative;
  return Math.max(-100, Math.min(100, Math.round(rawScore)));
}

/**
 * Retourne un label textuel pour le mood
 */
export function getMoodLabel(moodScore: number): string {
  if (moodScore >= 70) return 'euphorique';
  if (moodScore >= 50) return 'très heureux';
  if (moodScore >= 30) return 'content';
  if (moodScore >= 10) return 'bien';
  if (moodScore >= -10) return 'neutre';
  if (moodScore >= -30) return 'un peu triste';
  if (moodScore >= -50) return 'anxieux';
  if (moodScore >= -70) return 'stressé';
  return 'en détresse';
}

/**
 * Retourne un emoji pour le mood
 */
export function getMoodEmoji(moodScore: number): string {
  if (moodScore >= 70) return '🤩';
  if (moodScore >= 50) return '😄';
  if (moodScore >= 30) return '😊';
  if (moodScore >= 10) return '🙂';
  if (moodScore >= -10) return '😐';
  if (moodScore >= -30) return '😔';
  if (moodScore >= -50) return '😰';
  if (moodScore >= -70) return '😨';
  return '😱';
}

/**
 * Génère une description textuelle de l'état hormonal
 * (utilisée dans le prompt système du LLM)
 */
export function describeHormonalState(levels: HormoneLevels): string {
  const parts: string[] = [];
  
  // Dopamine
  if (levels.dopamine >= 75) parts.push('très motivé et enthousiaste');
  else if (levels.dopamine >= 55) parts.push('motivé');
  else if (levels.dopamine <= 25) parts.push('peu motivé, apathique');

  // Sérotonine
  if (levels.serotonin >= 75) parts.push('serein et stable');
  else if (levels.serotonin >= 55) parts.push('émotionnellement stable');
  else if (levels.serotonin <= 25) parts.push('émotionnellement instable');

  // Ocytocine
  if (levels.oxytocin >= 75) parts.push('très attaché et affectueux');
  else if (levels.oxytocin >= 55) parts.push('en confiance');
  else if (levels.oxytocin <= 25) parts.push('distant, peu en confiance');

  // Cortisol
  if (levels.cortisol >= 75) parts.push('très stressé et anxieux');
  else if (levels.cortisol >= 50) parts.push('stressé');
  else if (levels.cortisol <= 15) parts.push('détendu, sans stress');

  // Adrénaline
  if (levels.adrenaline >= 70) parts.push('surexcité, en alerte maximale');
  else if (levels.adrenaline >= 45) parts.push('excité, en alerte');

  // Endorphines
  if (levels.endorphins >= 70) parts.push('euphorique, plein de bien-être');
  else if (levels.endorphins >= 50) parts.push('confortable');

  if (parts.length === 0) parts.push('dans un état neutre et équilibré');

  return parts.join(', ');
}

/**
 * Vérifie si un événement émotionnel majeur est en cours
 * Utile pour décider de créer un flash memory
 */
export function isEmotionalPeak(levels: HormoneLevels): boolean {
  return (
    levels.dopamine >= 85 ||
    levels.cortisol >= 80 ||
    levels.oxytocin >= 85 ||
    levels.adrenaline >= 80 ||
    levels.endorphins >= 85
  );
}

/**
 * Calcule la "santé émotionnelle" globale (0-100)
 * Combine bien-être positif et absence de stress
 */
export function calculateEmotionalHealth(levels: HormoneLevels): number {
  const wellbeing = (levels.dopamine + levels.serotonin + levels.oxytocin + levels.endorphins) / 4;
  const stress = (levels.cortisol + levels.adrenaline * 0.3) / 1.3;
  const health = wellbeing - stress * 0.5;
  return Math.max(0, Math.min(100, Math.round(health)));
}
