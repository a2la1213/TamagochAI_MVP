// src/App.tsx
// Point d'entrée principal du TamagochAI

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTamagochaiStore } from './stores/useTamagochaiStore';
import { ChatScreen } from './screens/ChatScreen';
import { BirthScreen } from './screens/BirthScreen';
import { LoadingScreen } from './screens/LoadingScreen';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const initialize = useTamagochaiStore(s => s.initialize);
  const tamagochai = useTamagochaiStore(s => s.tamagochai);
  const isInitialized = useTamagochaiStore(s => s.isInitialized);

  useEffect(() => {
    const boot = async () => {
      try {
        await initialize();
      } catch (error) {
        console.error('Boot failed:', error);
      } finally {
        setIsReady(true);
      }
    };
    boot();
  }, []);

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" />
        <LoadingScreen message="Réveil en cours..." />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {isInitialized && tamagochai ? <ChatScreen /> : <BirthScreen />}
    </SafeAreaProvider>
  );
}
