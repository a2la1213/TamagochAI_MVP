// src/services/core/HormoneService.ts
// Service hormonal du TamagochAI — MVP COMPLET
//
// Ce service gère le système hormonal en temps réel :
// - Applique le decay naturel (retour au baseline)
// - Applique les modificateurs prédéfinis (événements)
// - Applique les modificateurs custom
// - Intègre la personnalité (génome) dans les réactions
// - Persiste l'état dans SQLite
// - Maintient un historique pour les stats
//
// CORRECTION V2 : Plus de bug "undefined" — les HORMONE_MODIFIERS
// sont importés directement depuis les constantes et vérifiés.

import {
  HormoneLevels,
  HormoneType,
  HormoneModifier,
  PredefinedModifier,
  HormoneSnapshot,
} from '../../types';
import { Genome } from '../../types/tamagochai';
import {
  HORMONE_CONFIGS,
  DEFAULT_HORMONE_LEVELS,
  HORMONE_MODIFIERS,
  applyDecayToAll,
  applyModifier,
  applyCustomModifiers,
  clampAllLevels,
  getDominantHormone,
  calculateMoodScore,
  getMoodLabel,
  getMoodEmoji,
  describeHormonalState,
  isEmotionalPeak,
  calculateEmotionalHealth,
} from '../../constants/hormones';
import { applyPersonalityToHormoneDelta } from './PersonalityService';
import {
  getHormoneState,
  saveHormoneState,
  addHormoneHistoryEntry,
} from '../database/DatabaseService';
import { createLogger, now, diffInMinutes } from '../../utils/helpers';

const log = createLogger('Hormones');

// ============================================================
// ÉTAT EN MÉMOIRE (cache pour éviter trop de lectures DB)
// ============================================================

let cachedLevels: HormoneLevels | null = null;
let cachedLastDecayAt: string | null = null;
let cachedTamagochaiId: string | null = null;

// ============================================================
// INITIALISATION
// ============================================================

/**
 * Charge l'état hormonal depuis la DB (ou initialise avec les défauts)
 */
export async function initHormones(tamagochaiId: string): Promise<HormoneLevels> {
  try {
    const state = await getHormoneState(tamagochaiId);

    if (state) {
      cachedLevels = { ...state.levels };
      cachedLastDecayAt = state.lastDecayAt;
      cachedTamagochaiId = tamagochaiId;
      log.info('Hormones loaded from DB:', cachedLevels);

      // Appliquer le decay accumulé depuis le dernier update
      const minutesSinceLastDecay = diffInMinutes(state.lastDecayAt, now());
      if (minutesSinceLastDecay > 1) {
        log.info(`Applying ${minutesSinceLastDecay.toFixed(0)} minutes of accumulated decay`);
        cachedLevels = applyDecayToAll(cachedLevels, minutesSinceLastDecay);
        await persistState(tamagochaiId, 'accumulated_decay');
      }
    } else {
      // Premier lancement — utiliser les défauts
      cachedLevels = { ...DEFAULT_HORMONE_LEVELS };
      cachedLastDecayAt = now();
      cachedTamagochaiId = tamagochaiId;
      log.info('Hormones initialized with defaults');
    }

    return { ...cachedLevels };
  } catch (error) {
    log.error('Failed to init hormones:', error);
    cachedLevels = { ...DEFAULT_HORMONE_LEVELS };
    cachedLastDecayAt = now();
    cachedTamagochaiId = tamagochaiId;
    return { ...cachedLevels };
  }
}

// ============================================================
// LECTURE
// ============================================================

/**
 * Retourne les niveaux hormonaux actuels (depuis le cache)
 */
export function getCurrentLevels(): HormoneLevels {
  if (!cachedLevels) {
    log.warn('Hormones not initialized, returning defaults');
    return { ...DEFAULT_HORMONE_LEVELS };
  }
  return { ...cachedLevels };
}

/**
 * Retourne un snapshot complet de l'état hormonal
 */
export function getSnapshot(): HormoneSnapshot {
  const levels = getCurrentLevels();
  return {
    levels,
    dominantHormone: getDominantHormone(levels),
    mood: getMoodLabel(calculateMoodScore(levels)),
    timestamp: now(),
  };
}

/**
 * Retourne le score de mood actuel (-100 à +100)
 */
export function getMood(): { score: number; label: string; emoji: string } {
  const levels = getCurrentLevels();
  const score = calculateMoodScore(levels);
  return {
    score,
    label: getMoodLabel(score),
    emoji: getMoodEmoji(score),
  };
}

/**
 * Retourne la description textuelle de l'état (pour le prompt LLM)
 */
export function getHormonalDescription(): string {
  return describeHormonalState(getCurrentLevels());
}

/**
 * Retourne la santé émotionnelle (0-100)
 */
export function getEmotionalHealth(): number {
  return calculateEmotionalHealth(getCurrentLevels());
}

/**
 * Vérifie si un pic émotionnel est en cours
 */
export function isAtPeak(): boolean {
  return isEmotionalPeak(getCurrentLevels());
}

/**
 * Retourne l'hormone dominante actuelle
 */
export function getDominant(): HormoneType {
  return getDominantHormone(getCurrentLevels());
}

// ============================================================
// MODIFICATION — ÉVÉNEMENTS PRÉDÉFINIS
// ============================================================

/**
 * Applique un modificateur prédéfini (ex: 'user_message', 'battery_low')
 * Intègre automatiquement la personnalité si un génome est fourni
 */
export async function triggerEvent(
  tamagochaiId: string,
  event: PredefinedModifier,
  genome?: Genome,
): Promise<HormoneLevels> {
  ensureInitialized();

  const modifiers = HORMONE_MODIFIERS[event];
  if (!modifiers || !Array.isArray(modifiers)) {
    log.warn(`Unknown predefined modifier: ${event}`);
    return getCurrentLevels();
  }

  log.info(`Trigger event: ${event} (${modifiers.length} modifiers)`);

  // Appliquer avec ou sans personnalité
  if (genome) {
    // Modifier les deltas en fonction du génome
    const personalizedModifiers: HormoneModifier[] = modifiers.map(mod => ({
      ...mod,
      delta: applyPersonalityToHormoneDelta(mod.delta, genome),
    }));
    cachedLevels = applyCustomModifiers(cachedLevels!, personalizedModifiers);
  } else {
    cachedLevels = applyModifier(cachedLevels!, event);
  }

  // Persister et historiser
  await persistState(tamagochaiId, event);

  log.info(`After ${event}:`, formatLevelsShort(cachedLevels!));
  return { ...cachedLevels! };
}

/**
 * Applique plusieurs événements en séquence
 */
export async function triggerEvents(
  tamagochaiId: string,
  events: PredefinedModifier[],
  genome?: Genome,
): Promise<HormoneLevels> {
  for (const event of events) {
    await triggerEvent(tamagochaiId, event, genome);
  }
  return getCurrentLevels();
}

// ============================================================
// MODIFICATION — ÉVÉNEMENTS CUSTOM
// ============================================================

/**
 * Applique des modificateurs custom (pas dans les prédéfinis)
 * Utile pour des effets spécifiques au contexte
 */
export async function applyCustom(
  tamagochaiId: string,
  modifiers: HormoneModifier[],
  genome?: Genome,
  eventLabel: string = 'custom',
): Promise<HormoneLevels> {
  ensureInitialized();

  // Appliquer la personnalité si disponible
  const finalModifiers = genome
    ? modifiers.map(mod => ({
        ...mod,
        delta: applyPersonalityToHormoneDelta(mod.delta, genome),
      }))
    : modifiers;

  cachedLevels = applyCustomModifiers(cachedLevels!, finalModifiers);
  await persistState(tamagochaiId, eventLabel);

  return { ...cachedLevels! };
}

/**
 * Modifie directement une seule hormone
 */
export async function adjustSingleHormone(
  tamagochaiId: string,
  hormone: HormoneType,
  delta: number,
  source: string,
  genome?: Genome,
): Promise<HormoneLevels> {
  return applyCustom(
    tamagochaiId,
    [{ hormone, delta, source }],
    genome,
    source,
  );
}

// ============================================================
// DECAY (retour naturel au baseline)
// ============================================================

/**
 * Applique le decay naturel des hormones
 * Appelé périodiquement (timer) ou avant chaque lecture importante
 */
export async function applyDecay(tamagochaiId: string): Promise<HormoneLevels> {
  ensureInitialized();

  if (!cachedLastDecayAt) {
    cachedLastDecayAt = now();
    return getCurrentLevels();
  }

  const elapsed = diffInMinutes(cachedLastDecayAt, now());

  if (elapsed < 1) {
    // Moins d'une minute, pas la peine
    return getCurrentLevels();
  }

  log.debug(`Applying decay: ${elapsed.toFixed(1)} minutes elapsed`);
  cachedLevels = applyDecayToAll(cachedLevels!, elapsed);
  cachedLastDecayAt = now();

  // Persister sans historiser (le decay est silencieux)
  await saveHormoneState(tamagochaiId, cachedLevels!);

  return { ...cachedLevels! };
}

// ============================================================
// ANALYSE DE MESSAGE
// ============================================================

/**
 * Analyse un message utilisateur et détermine ses effets hormonaux
 * Retourne les événements à déclencher
 */
export function analyzeMessageForHormones(
  message: string,
  isFirstMessageToday: boolean,
  minutesSinceLastMessage: number,
): PredefinedModifier[] {
  const events: PredefinedModifier[] = [];
  const lower = message.toLowerCase();

  // Toujours : un message = interaction
  events.push('user_message');

  // Premier message du jour
  if (isFirstMessageToday) {
    events.push('morning_greeting');
  }

  // Retour après absence
  if (minutesSinceLastMessage >= 240) {  // 4 heures
    events.push('user_return');
  }

  // Longue absence
  if (minutesSinceLastMessage >= 1440) {  // 24 heures
    events.push('long_absence');
  }

  // Compliment
  if (/(?:je t'aime|tu es génial|tu es super|bravo|merci beaucoup|adorable|meilleur|intelligent|bien joué|cool|incroyable)/.test(lower)) {
    events.push('user_compliment');
  }

  // Insulte
  if (/(?:idiot|stupide|nul|con|débile|merde|ta gueule|ferme[- ]la|connard)/.test(lower)) {
    events.push('user_insult');
  }

  // Humour
  if (/(?:haha|mdr|lol|ptdr|😂|🤣|mort de rire|trop drôle|xd)/.test(lower)) {
    events.push('humor_shared');
  }

  // Question existentielle
  if (/(?:tu es quoi|tu penses|tu ressens|conscience|vivant|réel|existes|ta nature|intelligence artificielle)/.test(lower)) {
    // Deep conversation si c'est existentiel
    events.push('deep_conversation');
  }

  // Message long et profond (>100 chars)
  if (message.length > 100) {
    events.push('deep_conversation');
  }

  // Dédupliquer
  return [...new Set(events)];
}

// ============================================================
// RÉACTIONS CONTEXTUELLES
// ============================================================

/**
 * Applique les effets de la batterie sur les hormones
 */
export async function applyBatteryEffect(
  tamagochaiId: string,
  batteryLevel: number,
  isCharging: boolean,
  genome?: Genome,
): Promise<void> {
  if (isCharging) {
    await triggerEvent(tamagochaiId, 'battery_charging', genome);
    return;
  }

  if (batteryLevel <= 0.05) {
    await triggerEvent(tamagochaiId, 'battery_critical', genome);
  } else if (batteryLevel <= 0.15) {
    await triggerEvent(tamagochaiId, 'battery_low', genome);
  } else if (batteryLevel >= 0.95) {
    await triggerEvent(tamagochaiId, 'battery_full', genome);
  }
}

/**
 * Applique les effets du moment de la journée
 */
export async function applyTimeOfDayEffect(
  tamagochaiId: string,
  hour: number,
  genome?: Genome,
): Promise<void> {
  if (hour >= 0 && hour < 6) {
    await triggerEvent(tamagochaiId, 'night_time', genome);
  }
}

// ============================================================
// HELPERS INTERNES
// ============================================================

/**
 * Vérifie que le service est initialisé
 */
function ensureInitialized(): void {
  if (!cachedLevels) {
    log.warn('Hormones not initialized! Using defaults');
    cachedLevels = { ...DEFAULT_HORMONE_LEVELS };
    cachedLastDecayAt = now();
  }
}

/**
 * Persiste l'état et ajoute à l'historique
 */
async function persistState(tamagochaiId: string, triggerEvent: string): Promise<void> {
  try {
    if (!cachedLevels) return;

    await saveHormoneState(tamagochaiId, cachedLevels);
    await addHormoneHistoryEntry(tamagochaiId, cachedLevels, triggerEvent);
    cachedLastDecayAt = now();
  } catch (error) {
    log.error('Failed to persist hormone state:', error);
  }
}

/**
 * Formate les niveaux en format court pour le log
 */
function formatLevelsShort(levels: HormoneLevels): string {
  return `D:${Math.round(levels.dopamine)} S:${Math.round(levels.serotonin)} O:${Math.round(levels.oxytocin)} C:${Math.round(levels.cortisol)} A:${Math.round(levels.adrenaline)} E:${Math.round(levels.endorphins)}`;
}

// ============================================================
// RESET (pour debug/test)
// ============================================================

/**
 * Reset les hormones aux valeurs par défaut
 */
export async function resetHormones(tamagochaiId: string): Promise<HormoneLevels> {
  cachedLevels = { ...DEFAULT_HORMONE_LEVELS };
  cachedLastDecayAt = now();
  await saveHormoneState(tamagochaiId, cachedLevels);
  log.info('Hormones reset to defaults');
  return { ...cachedLevels };
}

/**
 * Force des niveaux spécifiques (pour debug)
 */
export async function forceHormoneLevels(
  tamagochaiId: string,
  levels: Partial<HormoneLevels>,
): Promise<HormoneLevels> {
  ensureInitialized();
  cachedLevels = clampAllLevels({ ...cachedLevels!, ...levels });
  await persistState(tamagochaiId, 'forced');
  log.info('Hormones forced to:', formatLevelsShort(cachedLevels));
  return { ...cachedLevels };
}
