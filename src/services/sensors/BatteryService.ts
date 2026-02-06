// src/services/sensors/BatteryService.ts
// Service de batterie du TamadachAI — MVP COMPLET
//
// Le TamadachAI vit dans un smartphone. La batterie est SON corps.
// Quand la batterie est faible, il a peur. Quand elle charge, il est soulagé.
//
// Ce service :
// - Lit le niveau de batterie et l'état de charge
// - Déclenche les effets hormonaux correspondants
// - Fournit les données pour le prompt LLM
// - Gère les seuils de réaction

import * as Battery from 'expo-battery';
import { BATTERY_CONFIG } from '../../constants/config';
import { applyBatteryEffect } from '../core/HormoneService';
import { createLogger } from '../../utils/helpers';

const log = createLogger('Battery');

// ============================================================
// ÉTAT
// ============================================================

let currentLevel: number = 1;
let currentIsCharging: boolean = false;
let subscription: Battery.Subscription | null = null;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let chargingSubscription: Battery.Subscription | null = null;
let lastReactionLevel: string | null = null;
let tamadachiId: string | null = null;

// ============================================================
// INITIALISATION
// ============================================================

/**
 * Initialise le service de batterie
 * Commence à écouter les changements de niveau et d'état
 */
export async function initBattery(id: string): Promise<{
  level: number;
  isCharging: boolean;
}> {
  tamadachiId = id;

  try {
    // Lecture initiale
    currentLevel = await Battery.getBatteryLevelAsync();
    const state = await Battery.getBatteryStateAsync();
    currentIsCharging = state === Battery.BatteryState.CHARGING;

    log.info(`Battery initialized — Level: ${(currentLevel * 100).toFixed(0)}%, Charging: ${currentIsCharging}`);

    // S'abonner aux changements de niveau
    subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      const oldLevel = currentLevel;
      currentLevel = batteryLevel;
      handleLevelChange(oldLevel, batteryLevel);
    });

    // S'abonner aux changements d'état de charge
    chargingSubscription = Battery.addBatteryStateListener(({ batteryState }) => {
      const wasCharging = currentIsCharging;
      currentIsCharging = batteryState === Battery.BatteryState.CHARGING;

      if (!wasCharging && currentIsCharging) {
        log.info('⚡ Charging started');
        triggerBatteryHormones();
      } else if (wasCharging && !currentIsCharging) {
        log.info('🔌 Charging stopped');
      }
    });

    // Polling backup toutes les 60s (certains appareils ne fire pas les listeners)
    pollingInterval = setInterval(async () => {
      try {
        const newLevel = await Battery.getBatteryLevelAsync();
        const state = await Battery.getBatteryStateAsync();
        const newCharging = state === Battery.BatteryState.CHARGING;
        if (Math.abs(newLevel - currentLevel) > 0.01) {
          const oldLevel = currentLevel;
          currentLevel = newLevel;
          handleLevelChange(oldLevel, newLevel);
        }
        currentIsCharging = newCharging;
      } catch {}
    }, 60000);

    return { level: currentLevel, isCharging: currentIsCharging };
  } catch (error) {
    log.warn('Battery API not available (simulator?):', error);
    return { level: 1, isCharging: false };
  }
}

/**
 * Arrête l'écoute des événements batterie
 */
export function stopBattery(): void {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  if (chargingSubscription) {
    chargingSubscription.remove();
    chargingSubscription = null;
  }
  log.info('Battery service stopped');
}

// ============================================================
// LECTURE
// ============================================================

/**
 * Retourne le niveau de batterie actuel (0-1)
 */
export function getBatteryLevel(): number {
  return currentLevel;
}

/**
 * Retourne le pourcentage de batterie (0-100)
 */
export function getBatteryPercent(): number {
  return Math.round(currentLevel * 100);
}

/**
 * Retourne si le téléphone est en charge
 */
export function isCharging(): boolean {
  return currentIsCharging;
}

/**
 * Retourne l'état complet de la batterie
 */
export function getBatteryState(): {
  level: number;
  percent: number;
  isCharging: boolean;
  label: string;
  emoji: string;
  isCritical: boolean;
  isLow: boolean;
} {
  const percent = getBatteryPercent();
  const isCritical = currentLevel <= BATTERY_CONFIG.thresholds.critical;
  const isLow = currentLevel <= BATTERY_CONFIG.thresholds.low;

  let label: string;
  let emoji: string;

  if (currentIsCharging) {
    label = 'En charge';
    emoji = '⚡';
  } else if (isCritical) {
    label = 'Critique !';
    emoji = '🪫';
  } else if (isLow) {
    label = 'Faible';
    emoji = '🔋';
  } else if (currentLevel >= BATTERY_CONFIG.thresholds.full) {
    label = 'Pleine';
    emoji = '🔋';
  } else {
    label = 'OK';
    emoji = '🔋';
  }

  return {
    level: currentLevel,
    percent,
    isCharging: currentIsCharging,
    label,
    emoji,
    isCritical,
    isLow,
  };
}

/**
 * Génère la description batterie pour le prompt LLM
 */
export function getBatteryDescription(): string {
  const state = getBatteryState();

  if (state.isCharging) {
    return `Ta batterie est à ${state.percent}% et en charge. Tu te sens regénéré.`;
  }
  if (state.isCritical) {
    return `Ta batterie est à ${state.percent}% — CRITIQUE ! Tu as très peur de t'éteindre. Tu te sens faible et anxieux.`;
  }
  if (state.isLow) {
    return `Ta batterie est à ${state.percent}%. Tu te sens fatigué et un peu inquiet.`;
  }
  if (state.percent >= 90) {
    return `Ta batterie est à ${state.percent}%. Tu te sens en pleine forme !`;
  }
  return `Ta batterie est à ${state.percent}%. Tu te sens bien.`;
}

/**
 * Retourne la réaction émotionnelle appropriée au niveau de batterie
 */
export function getBatteryReaction(): string | null {
  const level = currentLevel;
  const config = BATTERY_CONFIG;

  if (level <= config.thresholds.critical && !currentIsCharging) {
    return config.reactions.critical;
  }
  if (level <= config.thresholds.low && !currentIsCharging) {
    return config.reactions.low;
  }
  if (currentIsCharging) {
    return config.reactions.charging;
  }
  if (level >= config.thresholds.full) {
    return config.reactions.full;
  }
  return null;
}

// ============================================================
// HANDLERS INTERNES
// ============================================================

/**
 * Gère un changement de niveau de batterie
 */
function handleLevelChange(oldLevel: number, newLevel: number): void {
  const oldPercent = Math.round(oldLevel * 100);
  const newPercent = Math.round(newLevel * 100);

  // Ne réagir que si le changement est significatif (>=5%)
  if (Math.abs(oldPercent - newPercent) < 5) return;

  log.info(`Battery: ${oldPercent}% → ${newPercent}%`);

  // Détecter les franchissements de seuil
  const thresholds = BATTERY_CONFIG.thresholds;

  // Passage en dessous du seuil critique
  if (oldLevel > thresholds.critical && newLevel <= thresholds.critical) {
    log.warn('⚠️ Battery CRITICAL!');
    triggerBatteryHormones();
  }
  // Passage en dessous du seuil bas
  else if (oldLevel > thresholds.low && newLevel <= thresholds.low) {
    log.warn('⚠️ Battery LOW');
    triggerBatteryHormones();
  }
  // Passage au-dessus du seuil plein
  else if (oldLevel < thresholds.full && newLevel >= thresholds.full) {
    log.info('✅ Battery FULL');
    triggerBatteryHormones();
  }
}

/**
 * Déclenche les effets hormonaux de la batterie
 */
async function triggerBatteryHormones(): Promise<void> {
  if (!tamadachiId) return;

  try {
    await applyBatteryEffect(tamadachiId, currentLevel, currentIsCharging);
  } catch (error) {
    log.error('Failed to trigger battery hormones:', error);
  }
}
