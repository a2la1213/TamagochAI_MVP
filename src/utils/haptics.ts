// src/utils/haptics.ts
// Service de vibrations haptic contextuelles

import { Vibration, Platform } from 'react-native';

export const Haptics = {
  /** Tap léger — bouton, selection */
  light(): void {
    Vibration.vibrate(10);
  },

  /** Tap moyen — envoi de message */
  medium(): void {
    Vibration.vibrate(25);
  },

  /** Notification — nouveau message reçu */
  notification(): void {
    Vibration.vibrate([0, 30, 50, 30]);
  },

  /** Succès — action complétée */
  success(): void {
    Vibration.vibrate([0, 40, 80, 40]);
  },

  /** Erreur — quelque chose a échoué */
  error(): void {
    Vibration.vibrate([0, 50, 50, 80, 50, 80]);
  },

  /** Naissance — séquence dramatique */
  birth(): void {
    Vibration.vibrate([0, 50, 100, 50, 100, 100, 200, 200, 100, 400]);
  },

  /** Évolution — montée en puissance */
  evolution(): void {
    Vibration.vibrate([0, 100, 100, 200, 100, 300]);
  },

  /** Rêve — doux et mystérieux */
  dream(): void {
    Vibration.vibrate([0, 20, 200, 20, 200, 20]);
  },

  /** Batterie critique — urgence */
  batteryCritical(): void {
    Vibration.vibrate([0, 100, 100, 100, 100, 100, 100, 100]);
  },
};
