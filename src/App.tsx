// src/App.tsx
// Point d'entrée principal du TamadachAI

import React, { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTamadachiStore } from './stores/useTamadachiStore';
import { ChatScreen } from './screens/ChatScreen';
import { BirthScreen } from './screens/BirthScreen';
import { LoadingScreen } from './screens/LoadingScreen';
import { ApiSetupScreen } from './screens/ApiSetupScreen';
import { registerBackgroundTask } from './services/core/BackgroundService';
import { hasAnyApiKey } from './services/llm/LLMOrchestrator';

// Enregistrer la tâche background au boot (avant le composant)
registerBackgroundTask();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [needsApiSetup, setNeedsApiSetup] = useState(false);
  const [birthAnimating, setBirthAnimating] = useState(false);
  const initialize = useTamadachiStore(s => s.initialize);
  const tamadachi = useTamadachiStore(s => s.tamadachi);
  const isInitialized = useTamadachiStore(s => s.isInitialized);
  const appState = useRef(AppState.currentState);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const boot = async () => {
      if (hasInitialized.current) return;
      hasInitialized.current = true;
      try {
        await initialize();
        // Vérifier si au moins une clé API est configurée
        const hasKey = await hasAnyApiKey();
        setNeedsApiSetup(!hasKey);
      } catch (error) {
        console.error('Boot failed:', error);
      } finally {
        setIsReady(true);
      }
    };
    boot();
  }, []);

  // Gérer le retour au premier plan SANS ré-initialiser
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        // Retour au premier plan — rafraîchir les données légères
        console.log('[App] Returned to foreground — refreshing...');
        const store = useTamadachiStore.getState();
        if (store.tamadachi) {
          // Refresh léger : batterie, messages, pas de full init
          store.refreshOnResume?.();
        }
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoadingScreen message="Réveil..." />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {needsApiSetup ? (
        <ApiSetupScreen onComplete={() => setNeedsApiSetup(false)} />
      ) : isInitialized && tamadachi && !birthAnimating ? (
        <ChatScreen />
      ) : (
        <BirthScreen onAnimStart={() => setBirthAnimating(true)} onAnimEnd={() => setBirthAnimating(false)} />
      )}
    </SafeAreaProvider>
  );
}
