// src/hooks/useTamagochai.ts
// Hooks React custom pour TamagochAI — MVP COMPLET
//
// Ces hooks sont des "vues" sur le store Zustand.
// Chaque hook sélectionne SEULEMENT les données dont
// le composant a besoin → optimisation des re-renders.
//
// Les composants utilisent CES hooks, jamais le store directement.

import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useTamagochaiStore } from '../stores';

// ============================================================
// HOOK PRINCIPAL — Initialisation de l'app
// ============================================================

/**
 * Hook d'initialisation — à utiliser dans App.tsx
 * Gère le démarrage et le shutdown propre
 */
export function useAppLifecycle() {
  const initialize = useTamagochaiStore(s => s.initialize);
  const shutdown = useTamagochaiStore(s => s.shutdown);
  const refreshState = useTamagochaiStore(s => s.refreshState);
  const isInitialized = useTamagochaiStore(s => s.isInitialized);
  const isInitializing = useTamagochaiStore(s => s.isInitializing);

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
  const messages = useTamagochaiStore(s => s.messages);
  const isGenerating = useTamagochaiStore(s => s.isGenerating);
  const streamingText = useTamagochaiStore(s => s.streamingText);
  const error = useTamagochaiStore(s => s.error);
  const sendMessage = useTamagochaiStore(s => s.sendMessage);
  const clearError = useTamagochaiStore(s => s.clearError);

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
 * Hook pour les données du TamagochAI
 */
export function useTamagochaiData() {
  const tamagochai = useTamagochaiStore(s => s.tamagochai);
  const emotion = useTamagochaiStore(s => s.emotion);
  const hormones = useTamagochaiStore(s => s.hormones);
  const isBorn = useTamagochaiStore(s => s.isBorn);

  return {
    tamagochai,
    name: tamagochai?.name || '',
    stage: tamagochai?.stage || 'emergence',
    totalXP: tamagochai?.totalXP || 0,
    genome: tamagochai?.genome || null,
    avatar: tamagochai?.avatar || null,
    stats: tamagochai?.stats || null,
    emotion,
    hormones,
    isBorn,
  };
}

// ============================================================
// HOOK NAISSANCE — Pour BirthScreen
// ============================================================

/**
 * Hook pour la création d'un nouveau TamagochAI
 */
export function useBirth() {
  const createTamagochai = useTamagochaiStore(s => s.createTamagochai);
  const isInitializing = useTamagochaiStore(s => s.isInitializing);
  const error = useTamagochaiStore(s => s.error);
  const isBorn = useTamagochaiStore(s => s.isBorn);

  return {
    createTamagochai,
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
  const tamagochai = useTamagochaiStore(s => s.tamagochai);
  const getProgressData = useTamagochaiStore(s => s.getProgressData);

  return {
    stage: tamagochai?.stage || 'emergence',
    totalXP: tamagochai?.totalXP || 0,
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
  const emotion = useTamagochaiStore(s => s.emotion);
  const getEmotionalSummary = useTamagochaiStore(s => s.getEmotionalSummary);

  return {
    primary: emotion?.primary || 'neutral',
    secondary: emotion?.secondary || null,
    intensity: emotion?.intensity || 0,
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
  const level = useTamagochaiStore(s => s.batteryLevel);
  const charging = useTamagochaiStore(s => s.batteryCharging);
  const getBatteryInfo = useTamagochaiStore(s => s.getBatteryInfo);

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
  const setApiKey = useTamagochaiStore(s => s.setApiKey);
  const setPreferredProvider = useTamagochaiStore(s => s.setPreferredProvider);
  const setProviderModel = useTamagochaiStore(s => s.setProviderModel);
  const setXPMode = useTamagochaiStore(s => s.setXPMode);
  const getLLMInfo = useTamagochaiStore(s => s.getLLMInfo);

  return {
    setApiKey,
    setPreferredProvider,
    setProviderModel,
    setXPMode,
    getLLMInfo,
  };
}
