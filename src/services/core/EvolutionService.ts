// src/services/core/EvolutionService.ts
// Service d'évolution du TamadachAI — MVP COMPLET
//
// Ce service gère toute la progression :
// - Attribution d'XP selon les interactions
// - Application de l'anti-grind
// - Détection et exécution des transitions de stade
// - Gestion des streaks (jours consécutifs)
// - Mode XP (production, prototype, debug)
//
// L'évolution est le cœur de l'expérience : chaque interaction
// compte, chaque message fait grandir le TamadachAI.

import {
  EvolutionStage,
  XPSource,
  XPEvent,
  EvolutionEvent,
  EvolutionProgress,
  XPMode,
} from '../../types/evolution';
import { Genome } from '../../types/tamadachi';
import {
  EVOLUTION_STAGES,
  STAGE_ORDER,
  XP_REWARDS,
  XP_MODES,
  ANTI_GRIND,
  STREAK_CONFIG,
  getStageForXP,
  shouldEvolve,
  calculateProgress,
  calculateFinalXP,
  getNextStage,
  getStageIndex,
  checkStreakBonus,
  getEvolutionMessage,
} from '../../constants/evolution';
import {
  getTamadachi,
  updateTamadachi,
  incrementTamadachiStat,
  recordXPEvent,
  recordEvolutionEvent,
  getXPThisHour,
  getXPToday,
  getConsecutiveXPGains,
  countMemories,
  getSetting,
  setSetting,
} from '../database/DatabaseService';
import { triggerEvent } from './HormoneService';
import { createLogger, now, isToday, isYesterday, daysSince } from '../../utils/helpers';

const log = createLogger('Evolution');

// ============================================================
// ÉTAT EN MÉMOIRE
// ============================================================

let currentXPMode: XPMode = 'prototype';  // Par défaut en mode proto pour le MVP
let lastXPGainTime: string | null = null;

// ============================================================
// INITIALISATION
// ============================================================

/**
 * Initialise le service d'évolution
 */
export async function initEvolution(): Promise<void> {
  try {
    // Charger le mode XP depuis les settings
    const savedMode = await getSetting('xp_mode');
    if (savedMode && (savedMode === 'production' || savedMode === 'prototype' || savedMode === 'debug')) {
      currentXPMode = savedMode;
    }
    log.info(`Evolution initialized — Mode: ${currentXPMode} (x${XP_MODES[currentXPMode].multiplier})`);
  } catch (error) {
    log.error('Failed to init evolution:', error);
  }
}

// ============================================================
// MODE XP
// ============================================================

/**
 * Retourne le mode XP actuel
 */
export function getXPMode(): XPMode {
  return currentXPMode;
}

/**
 * Change le mode XP
 */
export async function setXPMode(mode: XPMode): Promise<void> {
  currentXPMode = mode;
  await setSetting('xp_mode', mode);
  log.info(`XP Mode changed to: ${mode} (x${XP_MODES[mode].multiplier})`);
}

/**
 * Retourne la config du mode actuel
 */
export function getXPModeConfig() {
  return XP_MODES[currentXPMode];
}

// ============================================================
// ATTRIBUTION D'XP
// ============================================================

/**
 * Attribue de l'XP pour une source donnée
 * Applique automatiquement : mode, anti-grind, personnalité
 * Retourne le résultat complet du gain
 */
export async function awardXP(
  tamadachiId: string,
  source: XPSource,
  options?: {
    customAmount?: number;
    genome?: Genome;
    skipAntiGrind?: boolean;
  },
): Promise<{
  awarded: boolean;
  baseAmount: number;
  finalAmount: number;
  wasLimited: boolean;
  limitReason: string | null;
  newTotalXP: number;
  evolved: boolean;
  evolutionData: { from: EvolutionStage; to: EvolutionStage; message: string } | null;
}> {
  try {
    // Récupérer le TamadachAI
    const tama = await getTamadachi();
    if (!tama) {
      log.error('No TamadachAI found for XP award');
      return makeEmptyResult();
    }

    // Montant de base
    const baseAmount = options?.customAmount ?? XP_REWARDS[source]?.base ?? 0;
    if (baseAmount <= 0) {
      return makeEmptyResult();
    }

    // Vérifier le cooldown
    if (!options?.skipAntiGrind && lastXPGainTime) {
      const secondsSinceLast = (Date.now() - new Date(lastXPGainTime).getTime()) / 1000;
      if (secondsSinceLast < ANTI_GRIND.cooldownBetweenXP) {
        log.debug(`XP cooldown active (${secondsSinceLast.toFixed(0)}s < ${ANTI_GRIND.cooldownBetweenXP}s)`);
        return {
          awarded: false,
          baseAmount,
          finalAmount: 0,
          wasLimited: true,
          limitReason: 'Cooldown actif',
          newTotalXP: tama.totalXP,
          evolved: false,
          evolutionData: null,
        };
      }
    }

    // Calculer l'XP final avec anti-grind
    let finalAmount: number;
    let wasLimited = false;
    let limitReason: string | null = null;

    if (options?.skipAntiGrind) {
      finalAmount = baseAmount * XP_MODES[currentXPMode].multiplier;
    } else {
      const xpThisHour = await getXPThisHour(tamadachiId);
      const xpToday = await getXPToday(tamadachiId);
      const consecutiveGains = await getConsecutiveXPGains(tamadachiId);

      const result = calculateFinalXP(
        baseAmount,
        currentXPMode,
        xpThisHour,
        xpToday,
        consecutiveGains,
      );

      finalAmount = result.finalXP;
      wasLimited = result.wasLimited;
      limitReason = result.reason;
    }

    if (finalAmount <= 0) {
      return {
        awarded: false,
        baseAmount,
        finalAmount: 0,
        wasLimited: true,
        limitReason: limitReason || 'XP nul après calcul',
        newTotalXP: tama.totalXP,
        evolved: false,
        evolutionData: null,
      };
    }

    // Enregistrer le gain d'XP
    const description = XP_REWARDS[source]?.description || source;
    await recordXPEvent(
      tamadachiId,
      source,
      baseAmount,
      XP_MODES[currentXPMode].multiplier,
      finalAmount,
      description,
    );

    // Mettre à jour le total XP
    const newTotalXP = tama.totalXP + finalAmount;
    await updateTamadachi(tamadachiId, { total_xp: newTotalXP });
    lastXPGainTime = now();

    log.info(`XP awarded: +${finalAmount} (base: ${baseAmount}, mode: x${XP_MODES[currentXPMode].multiplier}) → Total: ${newTotalXP}`);

    // Vérifier si une évolution doit se produire
    const evolution = shouldEvolve(tama.stage, newTotalXP);
    let evolutionData: { from: EvolutionStage; to: EvolutionStage; message: string } | null = null;

    if (evolution.shouldEvolve && evolution.newStage) {
      evolutionData = await executeEvolution(
        tamadachiId,
        tama.name,
        tama.stage,
        evolution.newStage,
        newTotalXP,
      );
    }

    return {
      awarded: true,
      baseAmount,
      finalAmount,
      wasLimited,
      limitReason,
      newTotalXP,
      evolved: evolution.shouldEvolve,
      evolutionData,
    };
  } catch (error) {
    log.error('Failed to award XP:', error);
    return makeEmptyResult();
  }
}

/**
 * Attribue de l'XP pour plusieurs sources en une fois
 */
export async function awardMultipleXP(
  tamadachiId: string,
  sources: XPSource[],
  genome?: Genome,
): Promise<{ totalAwarded: number; evolved: boolean }> {
  let totalAwarded = 0;
  let evolved = false;

  for (const source of sources) {
    const result = await awardXP(tamadachiId, source, { genome });
    totalAwarded += result.finalAmount;
    if (result.evolved) evolved = true;
  }

  return { totalAwarded, evolved };
}

// ============================================================
// ÉVOLUTION (TRANSITION DE STADE)
// ============================================================

/**
 * Exécute une transition de stade
 */
async function executeEvolution(
  tamadachiId: string,
  name: string,
  fromStage: EvolutionStage,
  toStage: EvolutionStage,
  totalXP: number,
): Promise<{ from: EvolutionStage; to: EvolutionStage; message: string }> {
  log.info(`🌟 EVOLUTION: ${fromStage} → ${toStage} at ${totalXP} XP!`);

  // Compter les stats actuelles
  const memoriesCount = await countMemories(tamadachiId);
  const tama = await getTamadachi();
  const conversationsCount = tama?.stats.totalConversations || 0;

  // Enregistrer l'événement d'évolution
  await recordEvolutionEvent(
    tamadachiId,
    fromStage,
    toStage,
    totalXP,
    memoriesCount,
    conversationsCount,
  );

  // Mettre à jour le stade du TamadachAI
  await updateTamadachi(tamadachiId, {
    stage: toStage,
    stage_started_at: now(),
  });

  // Déclencher les effets hormonaux de l'évolution
  await triggerEvent(tamadachiId, 'evolution_up');

  // Générer le message d'évolution
  const message = getEvolutionMessage(name, fromStage, toStage);

  return { from: fromStage, to: toStage, message };
}

// ============================================================
// PROGRESSION
// ============================================================

/**
 * Retourne la progression actuelle vers le prochain stade
 */
export async function getProgress(tamadachiId: string): Promise<EvolutionProgress> {
  const tama = await getTamadachi();
  if (!tama) {
    return {
      currentStage: 'emergence',
      currentXP: 0,
      xpForCurrentStage: 0,
      xpForNextStage: 500,
      progressPercent: 0,
      xpRemaining: 500,
      nextStageName: 'Apprentissage',
      isMaxStage: false,
    };
  }

  return calculateProgress(tama.stage, tama.totalXP);
}

/**
 * Retourne un résumé de la progression pour l'UI
 */
export async function getProgressSummary(tamadachiId: string): Promise<{
  stage: EvolutionStage;
  stageName: string;
  stageEmoji: string;
  stageDescription: string;
  totalXP: number;
  progressPercent: number;
  xpRemaining: number;
  nextStageName: string | null;
  isMaxStage: boolean;
  xpMode: XPMode;
  xpMultiplier: number;
}> {
  const tama = await getTamadachi();
  const progress = await getProgress(tamadachiId);
  const stageConfig = EVOLUTION_STAGES[progress.currentStage];

  return {
    stage: progress.currentStage,
    stageName: stageConfig.name,
    stageEmoji: stageConfig.emoji,
    stageDescription: stageConfig.description,
    totalXP: progress.currentXP,
    progressPercent: progress.progressPercent,
    xpRemaining: progress.xpRemaining,
    nextStageName: progress.nextStageName,
    isMaxStage: progress.isMaxStage,
    xpMode: currentXPMode,
    xpMultiplier: XP_MODES[currentXPMode].multiplier,
  };
}

// ============================================================
// STREAKS
// ============================================================

/**
 * Met à jour le streak (jours consécutifs d'interaction)
 * Appelé au premier message de chaque session
 */
export async function updateStreak(tamadachiId: string): Promise<{
  currentStreak: number;
  bonusAwarded: boolean;
  bonusAmount: number;
  bonusLabel: string | null;
}> {
  try {
    const tama = await getTamadachi();
    if (!tama) return { currentStreak: 0, bonusAwarded: false, bonusAmount: 0, bonusLabel: null };

    const lastInteraction = tama.stats.lastInteraction;
    let newStreak = tama.stats.currentStreak;

    if (!lastInteraction) {
      // Premier jour
      newStreak = 1;
    } else if (isToday(lastInteraction)) {
      // Déjà interagi aujourd'hui, ne rien faire
      return {
        currentStreak: newStreak,
        bonusAwarded: false,
        bonusAmount: 0,
        bonusLabel: null,
      };
    } else if (isYesterday(lastInteraction)) {
      // Jour consécutif !
      newStreak += 1;
    } else {
      // Streak cassé — vérifier la fenêtre de grâce
      const hoursSince = (Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60);
      if (hoursSince <= STREAK_CONFIG.windowHours) {
        newStreak += 1;
      } else {
        // Streak perdu
        log.info(`Streak broken (${hoursSince.toFixed(0)}h since last interaction)`);
        newStreak = 1;
      }
    }

    // Mettre à jour en DB
    const longestStreak = Math.max(newStreak, tama.stats.longestStreak);
    await updateTamadachi(tamadachiId, {
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_interaction: now(),
    });

    // Vérifier les bonus de streak
    const bonus = checkStreakBonus(newStreak);
    let bonusAwarded = false;
    let bonusAmount = 0;
    let bonusLabel: string | null = null;

    if (bonus) {
      const result = await awardXP(tamadachiId, 'streak_bonus', {
        customAmount: bonus.bonus,
        skipAntiGrind: true,  // Les bonus de streak ne sont pas limités
      });
      bonusAwarded = result.awarded;
      bonusAmount = result.finalAmount;
      bonusLabel = bonus.label;
      log.info(`🔥 Streak bonus! Day ${newStreak}: +${bonusAmount} XP — ${bonus.label}`);
    }

    log.info(`Streak: ${newStreak} days (longest: ${longestStreak})`);

    return {
      currentStreak: newStreak,
      bonusAwarded,
      bonusAmount,
      bonusLabel,
    };
  } catch (error) {
    log.error('Failed to update streak:', error);
    return { currentStreak: 0, bonusAwarded: false, bonusAmount: 0, bonusLabel: null };
  }
}

// ============================================================
// ANALYSE DE MESSAGE POUR XP
// ============================================================

/**
 * Analyse un message utilisateur et détermine les sources d'XP
 */
export function analyzeMessageForXP(
  message: string,
  isFirstMessageToday: boolean,
  conversationMessageCount: number,
): XPSource[] {
  const sources: XPSource[] = [];
  const lower = message.toLowerCase();

  // Chaque message = XP de base
  sources.push('message_sent');

  // Premier message du jour
  if (isFirstMessageToday) {
    sources.push('daily_first');
  }

  // Message de qualité (long ou profond)
  if (message.length > 50 || message.includes('?')) {
    sources.push('message_quality');
  }

  // Question existentielle
  if (/(?:tu es quoi|tu penses|tu ressens|conscience|vivant|réel|existes|ta nature|sens de la vie)/.test(lower)) {
    sources.push('existential_question');
  }

  // L'humain enseigne quelque chose
  if (/(?:tu sais|je vais t'apprendre|en fait|c'est parce que|la raison|explique|voilà comment)/.test(lower)) {
    sources.push('user_teaches');
  }

  // Humour
  if (/(?:haha|mdr|lol|ptdr|😂|🤣|mort de rire|trop drôle)/.test(lower)) {
    sources.push('humor_shared');
  }

  // Conversation profonde (>10 messages dans la conv)
  if (conversationMessageCount >= 10 && message.length > 30) {
    sources.push('deep_conversation');
  }

  return sources;
}

// ============================================================
// STADE ACTUEL — HELPERS
// ============================================================

/**
 * Retourne la config du stade actuel
 */
export async function getCurrentStageConfig(tamadachiId: string) {
  const tama = await getTamadachi();
  const stage = tama?.stage || 'emergence';
  return (EVOLUTION_STAGES as Record<string, any>)[stage];
}

/**
 * Retourne le prompt style du stade actuel
 */
export async function getCurrentPromptStyle(tamadachiId: string): Promise<string> {
  const config = await getCurrentStageConfig(tamadachiId);
  return config.promptStyle;
}

/**
 * Vérifie si une feature est débloquée au stade actuel
 */
export async function isFeatureUnlocked(
  tamadachiId: string,
  feature: string,
): Promise<boolean> {
  const config = await getCurrentStageConfig(tamadachiId);
  return config.unlockedFeatures.includes(feature);
}

/**
 * Retourne le vocabulaire max du stade actuel
 */
export async function getMaxVocabulary(tamadachiId: string): Promise<number> {
  const config = await getCurrentStageConfig(tamadachiId);
  return config.maxVocabulary;
}

// ============================================================
// DEBUG / TEST
// ============================================================

/**
 * Force une évolution (pour debug)
 */
export async function forceEvolution(
  tamadachiId: string,
): Promise<{ from: EvolutionStage; to: EvolutionStage; message: string } | null> {
  const tama = await getTamadachi();
  if (!tama) return null;

  const next = getNextStage(tama.stage);
  if (!next) {
    log.warn('Already at max stage');
    return null;
  }

  const xpNeeded = EVOLUTION_STAGES[next].xpRequired;
  await updateTamadachi(tamadachiId, { total_xp: xpNeeded });

  return executeEvolution(tamadachiId, tama.name, tama.stage, next, xpNeeded);
}

/**
 * Force un stade spécifique (pour debug)
 */
export async function forceStage(
  tamadachiId: string,
  stage: EvolutionStage,
): Promise<void> {
  const xpNeeded = (EVOLUTION_STAGES as any)[stage].xpRequired;
  await updateTamadachi(tamadachiId, {
    stage,
    total_xp: xpNeeded,
    stage_started_at: now(),
  });
  log.info(`Forced stage to: ${stage} (${xpNeeded} XP)`);
}

// ============================================================
// HELPER INTERNE
// ============================================================

function makeEmptyResult() {
  return {
    awarded: false,
    baseAmount: 0,
    finalAmount: 0,
    wasLimited: false,
    limitReason: null,
    newTotalXP: 0,
    evolved: false,
    evolutionData: null,
  };
}
