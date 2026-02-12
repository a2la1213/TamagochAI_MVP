// src/services/core/BackgroundService.ts
// Service de tâches en arrière-plan
// Permet au TamadachAI de vivre même quand l'app est fermée

import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { createLogger } from '../../utils/helpers';

const log = createLogger('Background');
const BACKGROUND_TASK_NAME = 'TAMADACHI_BACKGROUND_TASK';

// ============================================================
// DÉFINIR LA TÂCHE (doit être au top-level, pas dans un composant)
// ============================================================

TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
  try {
    log.info('🔄 Background task running...');

    // Importer dynamiquement pour éviter les dépendances circulaires
    const { evaluateBackgroundNotification } = await import('./NotificationService');
    
    if (evaluateBackgroundNotification) {
      await evaluateBackgroundNotification();
    }

    log.info('✅ Background task completed');
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    log.error('Background task failed:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ============================================================
// ENREGISTRER LA TÂCHE
// ============================================================

export async function registerBackgroundTask(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
    if (isRegistered) {
      log.info('Background task already registered');
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: 15 * 60, // 15 minutes minimum
      stopOnTerminate: false,   // Continue après fermeture
      startOnBoot: true,        // Redémarre au boot du téléphone
    });

    log.info('✅ Background task registered (15min interval)');
  } catch (error) {
    log.error('Failed to register background task:', error);
  }
}

export async function unregisterBackgroundTask(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_TASK_NAME);
    log.info('Background task unregistered');
  } catch (error) {
    log.error('Failed to unregister background task:', error);
  }
}
