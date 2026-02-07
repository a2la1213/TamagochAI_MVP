// src/hooks/useTamadachi.ts
// Hooks React custom pour TamadachAI — MVP COMPLET
//
// Ces hooks sont des "vues" sur le store Zustand.
// Chaque hook sélectionne SEULEMENT les données dont
// le composant a besoin → optimisation des re-renders.
//
// Les composants utilisent CES hooks, jamais le store directement.

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useTamadachiStore } from '../stores';

// ============================================================
// HOOK PRINCIPAL — Initialisation de l'app
// ============================================================

/**
 * Hook d'initialisation — à utiliser dans App.tsx
 * Gère le démarrage et le shutdown propre
 */
export function useAppLifecycle() {
  const initialize = useTamadachiStore(s => s.initialize);
  const shutdown = useTamadachiStore(s => s.shutdown);
  const refreshState = useTamadachiStore(s => s.refreshState);
  const isInitialized = useTamadachiStore(s => s.isInitialized);
  const isInitializing = useTamadachiStore(s => s.isInitializing);

  useEffect(() => {
    initialize();
  }, []);

  // Gérer le cycle de vie de l'app (background/foreground)
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && isInitialized) {
        // Retour au premier plan → rafraîchir l'état
        refreshState();
      } else if (nextState === 'background') {
        // Passage en arrière-plan
        shutdown();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [isInitialized]);

  return { isInitialized, isInitializing };
}

// ============================================================
// HOOK CHAT — Pour l'écran de conversation
// ============================================================

/**
 * Hook pour le chat — sélectionne tout ce dont ChatScreen a besoin
 */
export function useChat() {
  const messages = useTamadachiStore(s => s.messages);
  const isGenerating = useTamadachiStore(s => s.isGenerating);
  const streamingText = useTamadachiStore(s => s.streamingText);
  const error = useTamadachiStore(s => s.error);
  const sendMessage = useTamadachiStore(s => s.sendMessage);
  const clearError = useTamadachiStore(s => s.clearError);

  return {
    messages,
    isGenerating,
    streamingText,
    error,
    sendMessage,
    clearError,
  };
}

// ============================================================
// HOOK TAMAGOCHAI — Données de l'entité
// ============================================================

/**
 * Hook pour les données du TamadachAI
 */
export function useTamadachiData() {
  const tamadachi = useTamadachiStore(s => s.tamadachi);
  const emotion = useTamadachiStore(s => s.emotion);
  const hormones = useTamadachiStore(s => s.hormones);
  const isBorn = useTamadachiStore(s => s.isBorn);

  return {
    tamadachi,
    name: tamadachi?.name || '',
    stage: tamadachi?.stage || 'emergence',
    totalXP: tamadachi?.totalXP || 0,
    genome: tamadachi?.genome || null,
    avatar: tamadachi?.avatar || null,
    stats: tamadachi?.stats || null,
    emotion,
    hormones,
    isBorn,
  };
}

// ============================================================
// HOOK NAISSANCE — Pour BirthScreen
// ============================================================

/**
 * Hook pour la création d'un nouveau TamadachAI
 */
export function useBirth() {
  const createTamadachi = useTamadachiStore(s => s.createTamadachi);
  const isInitializing = useTamadachiStore(s => s.isInitializing);
  const error = useTamadachiStore(s => s.error);
  const isBorn = useTamadachiStore(s => s.isBorn);

  return {
    createTamadachi,
    isCreating: isInitializing,
    error,
    isBorn,
  };
}

// ============================================================
// HOOK ÉVOLUTION — Pour la barre de progression
// ============================================================

/**
 * Hook pour les données d'évolution
 */
export function useEvolution() {
  const tamadachi = useTamadachiStore(s => s.tamadachi);
  const getProgressData = useTamadachiStore(s => s.getProgressData);

  return {
    stage: tamadachi?.stage || 'emergence',
    totalXP: tamadachi?.totalXP || 0,
    getProgressData,
  };
}

// ============================================================
// HOOK ÉMOTION — Pour l'avatar et les indicateurs
// ============================================================

/**
 * Hook pour l'état émotionnel
 */
export function useEmotion() {
  const emotion = useTamadachiStore(s => s.emotion);
  const getEmotionalSummary = useTamadachiStore(s => s.getEmotionalSummary);

  return {
    primary: emotion?.primary || 'neutral',
    secondary: emotion?.secondary || null,
    intensity: emotion?.intensity ? Math.round(emotion.intensity <= 1 ? emotion.intensity * 100 : emotion.intensity) : 0,
    emoji: emotion?.emoji || '😐',
    description: emotion?.description || '',
    getSummary: getEmotionalSummary,
  };
}

// ============================================================
// HOOK BATTERIE — Pour l'indicateur batterie
// ============================================================

/**
 * Hook pour la batterie
 */
export function useBattery() {
  const level = useTamadachiStore(s => s.batteryLevel);
  const charging = useTamadachiStore(s => s.batteryCharging);
  const getBatteryInfo = useTamadachiStore(s => s.getBatteryInfo);

  return {
    level,
    percent: Math.round(level * 100),
    isCharging: charging,
    getInfo: getBatteryInfo,
  };
}

// ============================================================
// HOOK SETTINGS — Pour l'écran de configuration
// ============================================================

/**
 * Hook pour les paramètres LLM et app
 */
export function useSettings() {
  const setApiKey = useTamadachiStore(s => s.setApiKey);
  const setPreferredProvider = useTamadachiStore(s => s.setPreferredProvider);
  const setProviderModel = useTamadachiStore(s => s.setProviderModel);
  const setXPMode = useTamadachiStore(s => s.setXPMode);
  const getLLMInfo = useTamadachiStore(s => s.getLLMInfo);

  return {
    setApiKey,
    setPreferredProvider,
    setProviderModel,
    setXPMode,
    getLLMInfo,
  };
}
