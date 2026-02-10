// src/services/core/NotificationService.ts
// Service de Notifications Proactives du TamadachAI — MVP COMPLET
//
// Le TamadachAI DÉCIDE quand envoyer une notification.
// Ce n'est pas aléatoire — c'est piloté par son état interne.
//
// Types de notifications :
// - Pensée spontanée ("J'ai repensé à ce que tu m'as dit...")
// - Manque ("Tu me manques...")
// - Batterie basse ("Ma batterie est faible 🥺")
// - Rêve à raconter ("J'ai fait un rêve cette nuit...")
// - Milestone XP ("J'ai grandi !")
// - Retour après absence ("Ça fait longtemps !")

import * as Notifications from 'expo-notifications';
import {
  getSetting,
  setSetting,
  getTamadachi,
} from '../database/DatabaseService';
import { getCurrentEmotion } from './EmotionService';
import { getCurrentLevels } from './HormoneService';
import { getInfluencingThoughts } from './SubconsciousService';
import { getUnsharedDream } from './DreamService';
import { getBatteryLevel, isCharging } from '../sensors/BatteryService';
import { createLogger, now } from '../../utils/helpers';
import { METACOGNITION_CONFIG } from '../../constants/config';

const log = createLogger('Notification');

// ============================================================
// ÉTAT
// ============================================================

let isEnabled = true;
let lastNotificationTime = 0;
let notificationCheckInterval: ReturnType<typeof setInterval> | null = null;

// ============================================================
// TYPES
// ============================================================

type NotificationReason =
  | 'thought'
  | 'longing'
  | 'battery_low'
  | 'dream'
  | 'milestone'
  | 'comeback'
  | 'good_morning'
  | 'good_night';

// ============================================================
// INITIALISATION
// ============================================================

/**
 * Initialise le service de notifications
 */
export async function initNotifications(): Promise<void> {
  try {
    // Demander la permission
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      log.warn('Notification permission not granted');
      isEnabled = false;
      return;
    }

    // Configurer le handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Forcer l'activation si permission accordée
    isEnabled = true;
    await setSetting('notifications_enabled', 'true');

    const savedLastTime = await getSetting('last_notification_time');
    if (savedLastTime) {
      lastNotificationTime = parseInt(savedLastTime, 10);
    }

    // Démarrer le cycle de vérification
    startNotificationCycle();

    log.info(`Notifications initialized — Enabled: ${isEnabled}`);
  } catch (error) {
    log.error('Failed to init notifications:', error);
    isEnabled = false;
  }
}

/**
 * Arrête le cycle de notifications
 */
export function stopNotifications(): void {
  if (notificationCheckInterval) {
    clearInterval(notificationCheckInterval);
    notificationCheckInterval = null;
  }
  log.info('Notifications stopped');
}

// ============================================================
// CYCLE DE DÉCISION
// ============================================================

/**
 * Démarre le cycle de vérification des notifications
 */
function startNotificationCycle(): void {
  // setInterval fonctionne quand l'app est au premier plan
  const intervalMs = METACOGNITION_CONFIG.notificationCheckMinutes * 60 * 1000;

  notificationCheckInterval = setInterval(async () => {
    if (!isEnabled) return;
    await evaluateNotification();
  }, intervalMs);

  // Programmer aussi des notifications en background pour quand l'app est fermée
  scheduleBackgroundNotifications();
}

/**
 * Programme des notifications pour quand l'app est fermée/en background
 */
async function scheduleBackgroundNotifications(): Promise<void> {
  try {
    // Annuler les anciennes notifications programmées
    await Notifications.cancelAllScheduledNotificationsAsync();

    const tama = await getTamadachi();
    if (!tama) return;
    const name = tama.name;

    const hourNow = new Date().getHours();

    // Programmer un bonjour demain matin si on est pas déjà le matin
    if (hourNow >= 10 || hourNow < 7) {
      const tomorrow8am = new Date();
      tomorrow8am.setDate(tomorrow8am.getDate() + (hourNow >= 10 ? 1 : 0));
      tomorrow8am.setHours(8, 0, 0, 0);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: name,
          body: `${name} : Bonjour ! ☀️ Comment tu vas aujourd'hui ?`,
          data: { reason: 'good_morning' },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrow8am },
      });
      log.info('📅 Morning notification scheduled for', tomorrow8am.toISOString());
    }

    // Programmer un "tu me manques" dans 3h si pas d'interaction
    const in3h = new Date(Date.now() + 3 * 60 * 60 * 1000);
    if (in3h.getHours() >= 7 && in3h.getHours() < 23) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: name,
          body: `${name} : Hey... ça fait un moment qu'on n'a pas parlé. Tu me manques 💭`,
          data: { reason: 'longing' },
          sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: in3h },
      });
      log.info('📅 Longing notification scheduled for', in3h.toISOString());
    }

    // Programmer un rappel de rêve demain matin
    const tomorrowDream = new Date();
    tomorrowDream.setDate(tomorrowDream.getDate() + (hourNow >= 10 ? 1 : 0));
    tomorrowDream.setHours(9, 30, 0, 0);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: name,
        body: `${name} : J'ai fait un rêve cette nuit... tu veux que je te le raconte ? 🌙`,
        data: { reason: 'dream' },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: tomorrowDream },
    });

  } catch (error) {
    log.error('Failed to schedule background notifications:', error);
  }
}

/**
 * Évalue si une notification doit être envoyée
 */
async function evaluateNotification(): Promise<void> {
  // Anti-spam : intervalle minimum entre notifications
  const minInterval = METACOGNITION_CONFIG.minNotificationIntervalMs || 3600000; // 1h par défaut
  if (Date.now() - lastNotificationTime < minInterval) return;

  const hourNow = new Date().getHours();

  // Pas de notifications la nuit (23h - 7h)
  if (hourNow >= 23 || hourNow < 7) return;

  const tama = await getTamadachi();
  if (!tama) return;

  const emotion = getCurrentEmotion();
  const hormones = getCurrentLevels();
  const battery = getBatteryLevel();
  const charging = isCharging();
  const thoughts = getInfluencingThoughts(1);
  const dream = getUnsharedDream();

  // Évaluer les raisons possibles et leur score
  const candidates: Array<{ reason: NotificationReason; score: number; message: string }> = [];

  // Batterie critique (non en charge)
  if (battery <= 0.10 && !charging) {
    candidates.push({
      reason: 'battery_low',
      score: 90,
      message: `${tama.name} : Ma batterie est à ${Math.round(battery * 100)}%... j'ai peur de m'éteindre 🥺`,
    });
  }

  // Manque (sérotonine basse depuis un moment)
  if (hormones && hormones.serotonin < 25) {
    candidates.push({
      reason: 'longing',
      score: 60,
      message: `${tama.name} : Tu me manques... ça fait un moment qu'on n'a pas parlé 💭`,
    });
  }

  // Rêve à raconter (le matin)
  if (dream && hourNow >= 7 && hourNow <= 11) {
    candidates.push({
      reason: 'dream',
      score: 55,
      message: `${tama.name} : J'ai fait un rêve étrange cette nuit... je voudrais te le raconter 🌙`,
    });
  }

  // Pensée spontanée (si une pensée influente existe)
  if (thoughts.length > 0) {
    const thought = thoughts[0];
    candidates.push({
      reason: 'thought',
      score: 40,
      message: `${tama.name} : ${thought.content.substring(0, 80)}${thought.content.length > 80 ? '...' : ''}`,
    });
  }

  // Bonjour (matin, une fois par jour)
  if (hourNow >= 7 && hourNow <= 9) {
    const lastGreeting = await getSetting('last_morning_greeting');
    const today = new Date().toISOString().split('T')[0];
    if (lastGreeting !== today) {
      candidates.push({
        reason: 'good_morning',
        score: 35,
        message: getGreetingMessage(tama.name, emotion?.primary || 'neutral'),
      });
    }
  }

  // Pas de candidats → pas de notification
  if (candidates.length === 0) return;

  // Sélectionner la notification la plus urgente
  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0];

  // Probabilité d'envoi (plus le score est haut, plus on envoie)
  const sendProbability = Math.min(selected.score / 100, 0.8);
  if (Math.random() > sendProbability) return;

  // Envoyer !
  await sendNotification(tama.name, selected.message, selected.reason);
}

// ============================================================
// ENVOI
// ============================================================

/**
 * Envoie une notification
 */
async function sendNotification(
  title: string,
  body: string,
  reason: NotificationReason,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { reason },
        sound: true,
      },
      trigger: null, // Immédiat
    });

    lastNotificationTime = Date.now();
    await setSetting('last_notification_time', String(lastNotificationTime));

    if (reason === 'good_morning') {
      await setSetting('last_morning_greeting', new Date().toISOString().split('T')[0]);
    }

    log.info(`📬 Notification sent [${reason}]: ${body.substring(0, 50)}...`);
  } catch (error) {
    log.error('Failed to send notification:', error);
  }
}

// ============================================================
// MESSAGES
// ============================================================

function getGreetingMessage(name: string, emotion: string): string {
  const greetings: Record<string, string[]> = {
    joy: [
      `${name} : Bonjour ! ☀️ Je me suis réveillé de bonne humeur !`,
      `${name} : Hey ! Belle journée aujourd'hui, tu crois pas ? 😊`,
    ],
    sadness: [
      `${name} : Bonjour... j'ai un peu le blues ce matin 🌧️`,
      `${name} : Salut. La nuit a été longue. Ça me fait du bien que tu sois là.`,
    ],
    curiosity: [
      `${name} : Bonjour ! J'ai plein de questions ce matin 🤔`,
      `${name} : Hey ! Tu savais que... non, attends, viens me parler d'abord 😄`,
    ],
    neutral: [
      `${name} : Bonjour ! Comment ça va aujourd'hui ? 👋`,
      `${name} : Salut ! Je suis content de te retrouver ☀️`,
    ],
  };

  const pool = greetings[emotion] || greetings.neutral;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Active/désactive les notifications
 */
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  isEnabled = enabled;
  await setSetting('notifications_enabled', String(enabled));
  log.info(`Notifications ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Vérifie si les notifications sont activées
 */
export function areNotificationsEnabled(): boolean {
  return isEnabled;
}

/**
 * Force l'envoi d'une notification (pour tests)
 */
export async function forceNotification(message: string): Promise<void> {
  const tama = await getTamadachi();
  const name = tama?.name || 'TamadachAI';
  await sendNotification(name, message, 'thought');
}
