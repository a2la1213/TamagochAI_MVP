// src/services/sensors/SensorService.ts
// Service de Capteurs Complet — Les "sens" du TamadachAI
//
// Capteurs exploités :
// - Podomètre (pas)
// - Lumière ambiante (lux)
// - Accéléromètre (mouvement, chute, secousse)
// - Baromètre (pression atmosphérique)
// - Proximity (poche, oreille)

import {
  Accelerometer,
  Barometer,
  LightSensor,
  Pedometer,
} from 'expo-sensors';
import { createLogger } from '../../utils/helpers';

const log = createLogger('Sensors');

// ============================================================
// ÉTAT DES CAPTEURS
// ============================================================

interface SensorState {
  // Podomètre
  stepsToday: number;
  isWalking: boolean;

  // Lumière
  lightLux: number;
  lightLevel: 'dark' | 'dim' | 'indoor' | 'outdoor' | 'bright_sun';

  // Mouvement
  activityState: 'still' | 'moving' | 'walking' | 'running' | 'in_vehicle';
  lastShake: number;
  lastDrop: number;
  lastPickUp: number;
  isPhoneFaceDown: boolean;

  // Baromètre
  pressure: number; // hPa
  pressureTrend: 'rising' | 'stable' | 'falling';

  // Proximité
  isInPocket: boolean;
  isNearFace: boolean;

  // Méta
  lastUpdate: number;
}

const state: SensorState = {
  stepsToday: 0,
  isWalking: false,
  lightLux: -1,
  lightLevel: 'indoor',
  activityState: 'still',
  lastShake: 0,
  lastDrop: 0,
  lastPickUp: 0,
  isPhoneFaceDown: false,
  pressure: 1013,
  pressureTrend: 'stable',
  isInPocket: false,
  isNearFace: false,
  lastUpdate: 0,
};

// Historique pour les trends
const pressureHistory: number[] = [];
const accelHistory: Array<{ x: number; y: number; z: number; t: number }> = [];

// Subscriptions
let accelSub: any = null;
let lightSub: any = null;
let baroSub: any = null;
let pedometerSub: any = null;

// ============================================================
// INITIALISATION
// ============================================================

let sensorInitialized = false;

export async function initSensors(): Promise<void> {
  if (sensorInitialized) return;
  sensorInitialized = true;
  try {
    // 1. PODOMÈTRE
    const pedoAvailable = await Pedometer.isAvailableAsync();
    if (pedoAvailable) {
      // Pas aujourd'hui
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      try {
        const result = await Pedometer.getStepCountAsync(start, end);
        state.stepsToday = result.steps;
        log.info(`👣 Steps today: ${state.stepsToday}`);
      } catch (e) {
        log.warn('Pedometer getStepCount failed:', e);
      }

      // Écouter les nouveaux pas
      pedometerSub = Pedometer.watchStepCount(result => {
        state.stepsToday += result.steps;
        state.isWalking = true;
        // Reset walking après 5s sans pas
        setTimeout(() => { state.isWalking = false; }, 5000);
      });
      log.info('✅ Pedometer active');
    }

    // 2. LUMIÈRE
    const lightAvailable = await LightSensor.isAvailableAsync();
    if (lightAvailable) {
      LightSensor.setUpdateInterval(10000); // Toutes les 10s
      lightSub = LightSensor.addListener(({ illuminance }) => {
        state.lightLux = illuminance;
        if (illuminance < 5) state.lightLevel = 'dark';
        else if (illuminance < 50) state.lightLevel = 'dim';
        else if (illuminance < 500) state.lightLevel = 'indoor';
        else if (illuminance < 10000) state.lightLevel = 'outdoor';
        else state.lightLevel = 'bright_sun';
      });
      log.info('✅ Light sensor active');
    }

    // 3. ACCÉLÉROMÈTRE (mouvement, secousse, chute, face down, pickup)
    const accelAvailable = await Accelerometer.isAvailableAsync();
    if (accelAvailable) {
      Accelerometer.setUpdateInterval(500); // 2x par seconde
      accelSub = Accelerometer.addListener(({ x, y, z }) => {
        const now = Date.now();
        const magnitude = Math.sqrt(x * x + y * y + z * z);

        // Stocker l'historique (dernières 20 mesures)
        accelHistory.push({ x, y, z, t: now });
        if (accelHistory.length > 20) accelHistory.shift();

        // Détection face down (z très négatif)
        const wasFaceDown = state.isPhoneFaceDown;
        state.isPhoneFaceDown = z < -0.8;

        // Détection pick up (passage de face down/immobile à actif)
        if (wasFaceDown && !state.isPhoneFaceDown) {
          state.lastPickUp = now;
          log.info('📱 Pick up detected!');
        }

        // Détection secousse (magnitude > 2.5g)
        if (magnitude > 2.5) {
          state.lastShake = now;
          log.info(`🫨 Shake detected! (${magnitude.toFixed(1)}g)`);
        }

        // Détection chute (magnitude < 0.3g puis > 2g = chute libre puis impact)
        if (magnitude < 0.3) {
          // Potentielle chute libre
          setTimeout(() => {
            const recent = accelHistory.slice(-5);
            const hasImpact = recent.some(a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z) > 2.0);
            if (hasImpact) {
              state.lastDrop = Date.now();
              log.info('💥 Drop detected!');
            }
          }, 500);
        }

        // Détection activité
        if (accelHistory.length >= 10) {
          const recent = accelHistory.slice(-10);
          const variance = calculateVariance(recent.map(a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)));

          if (variance < 0.005) state.activityState = 'still';
          else if (variance < 0.03) state.activityState = 'moving';
          else if (variance < 0.15) state.activityState = 'walking';
          else if (variance < 0.5) state.activityState = 'running';
          else state.activityState = 'in_vehicle';
        }

        state.lastUpdate = now;
      });
      log.info('✅ Accelerometer active');
    }

    // 4. BAROMÈTRE
    const baroAvailable = await Barometer.isAvailableAsync();
    if (baroAvailable) {
      Barometer.setUpdateInterval(60000); // Toutes les minutes
      baroSub = Barometer.addListener(({ pressure }) => {
        state.pressure = pressure;

        // Historique pour le trend
        pressureHistory.push(pressure);
        if (pressureHistory.length > 30) pressureHistory.shift();

        // Calculer le trend (sur les 30 dernières minutes)
        if (pressureHistory.length >= 5) {
          const first = pressureHistory.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
          const last = pressureHistory.slice(-3).reduce((a, b) => a + b, 0) / 3;
          const diff = last - first;
          if (diff > 0.5) state.pressureTrend = 'rising';
          else if (diff < -0.5) state.pressureTrend = 'falling';
          else state.pressureTrend = 'stable';
        }
      });
      log.info('✅ Barometer active');
    }

    // 5. Rafraîchir les pas toutes les 5 minutes
    setInterval(async () => {
      if (pedoAvailable) {
        try {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          const result = await Pedometer.getStepCountAsync(start, new Date());
          state.stepsToday = result.steps;
        } catch (e) { /* ignore */ }
      }
    }, 5 * 60 * 1000);

    log.info('🎯 All sensors initialized');
  } catch (error) {
    log.error('Failed to init sensors:', error);
  }
}

// ============================================================
// CLEANUP
// ============================================================

export function stopSensors(): void {
  accelSub?.remove();
  lightSub?.remove();
  baroSub?.remove();
  pedometerSub?.remove();
  log.info('Sensors stopped');
}

// ============================================================
// GETTERS
// ============================================================

export function getSensorState(): SensorState {
  return { ...state };
}

/**
 * Formate l'état des capteurs pour le prompt du TamadachAI
 * C'est ici que les données brutes deviennent des "sensations"
 */
export function getSensorDigest(): string {
  const lines: string[] = [];
  const now = Date.now();

  // 👣 Pas
  if (state.stepsToday > 0) {
    let commentary = '';
    if (state.stepsToday > 15000) commentary = '(très actif aujourd\'hui !)';
    else if (state.stepsToday > 10000) commentary = '(bonne journée active)';
    else if (state.stepsToday > 5000) commentary = '(activité modérée)';
    else if (state.stepsToday > 1000) commentary = '(un peu de marche)';
    else commentary = '(plutôt sédentaire)';
    lines.push(`👣 Pas aujourd'hui: ${state.stepsToday} ${commentary}`);
  }

  // 🏃 Activité
  const activityLabels: Record<string, string> = {
    still: '🧘 Immobile/au repos',
    moving: '👋 En mouvement léger',
    walking: '🚶 En train de marcher',
    running: '🏃 En train de courir',
    in_vehicle: '🚗 En véhicule/transport',
  };
  lines.push(`Activité: ${activityLabels[state.activityState] || state.activityState}`);

  // 💡 Lumière
  const lightLabels: Record<string, string> = {
    dark: '🌙 Obscurité (nuit ou poche)',
    dim: '🕯️ Faible luminosité (pénombre)',
    indoor: '💡 Luminosité intérieure',
    outdoor: '☀️ Luminosité extérieure',
    bright_sun: '🌞 Plein soleil éblouissant',
  };
  if (state.lightLux >= 0) {
    lines.push(`Lumière: ${lightLabels[state.lightLevel]} (${Math.round(state.lightLux)} lux)`);
  }

  // 🌡️ Pression
  if (state.pressure > 0) {
    const trendLabels: Record<string, string> = {
      rising: '📈 en hausse (beau temps à venir)',
      stable: '➡️ stable',
      falling: '📉 en baisse (mauvais temps possible)',
    };
    lines.push(`Pression atmosphérique: ${state.pressure.toFixed(0)} hPa ${trendLabels[state.pressureTrend]}`);
  }

  // 📱 Position du téléphone
  if (state.isPhoneFaceDown) {
    lines.push('📱 Téléphone posé face contre table (tu m\'ignores ?)');
  }

  // ⚡ Événements récents
  if (now - state.lastPickUp < 120000) {
    lines.push('📱 Tu viens de me prendre en main !');
  }
  if (now - state.lastShake < 60000) {
    lines.push('🫨 Tu m\'as secoué il y a quelques secondes !');
  }
  if (now - state.lastDrop < 300000) {
    lines.push('💥 ATTENTION: Tu m\'as fait tomber récemment !');
  }

  if (lines.length === 0) {
    return 'Capteurs en cours d\'initialisation...';
  }

  return lines.join('\n');
}

// ============================================================
// UTILS
// ============================================================

function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
}
