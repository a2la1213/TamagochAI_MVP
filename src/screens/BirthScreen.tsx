// src/screens/BirthScreen.tsx
// Écran de naissance — Animation spectaculaire avec GenomeReveal

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Vibration,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../constants/config';
import { useTamadachiStore } from '../stores/useTamadachiStore';
import { GenomeReveal } from '../components/modals/GenomeReveal';
import { SettingsScreen } from './SettingsScreen';
import { Genome } from '../types';
import { getAvailableProviders } from '../services/llm/LLMOrchestrator';

type Phase = 'input' | 'creating' | 'born' | 'genome' | 'done';

export function BirthScreen() {
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [showSettings, setShowSettings] = useState(false);
  const [genome, setGenome] = useState<Genome | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const particleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const createTamadachi = useTamadachiStore(s => s.createTamadachi);
  const hasProvider = getAvailableProviders().length > 0;

  // Pulse animation pendant la création
  useEffect(() => {
    if (phase === 'creating') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      ).start();

      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      }).start();
    }
  }, [phase]);

  const handleBirth = async () => {
    if (!name.trim()) return;
    Keyboard.dismiss();

    // Phase: Creating
    setPhase('creating');
    Vibration.vibrate([0, 50, 100, 50, 100, 100]);

    try {
      await createTamadachi(name.trim());

      // Phase: Born — explosion de lumière
      setPhase('born');
      Vibration.vibrate([0, 200, 100, 400]);

      Animated.sequence([
        Animated.timing(particleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.delay(500),
      ]).start(() => {
        // Récupérer le genome
        const state = useTamadachiStore.getState();
        if (state.tamadachi?.genome) {
          setGenome(state.tamadachi.genome);
          setPhase('genome');
        } else {
          setPhase('done');
        }
      });

    } catch (error) {
      setPhase('input');
    }
  };

  if (showSettings) {
    return <SettingsScreen onClose={() => setShowSettings(false)} />;
  }

  // Phase: Genome reveal
  if (phase === 'genome' && genome) {
    return (
      <GenomeReveal
        visible
        genome={genome}
        name={name}
        onComplete={() => setPhase('done')}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Settings button */}
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => setShowSettings(true)}
      >
        <Text style={styles.settingsText}>⚙️ Paramètres</Text>
      </TouchableOpacity>

      {/* Provider warning */}
      {!hasProvider && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            ⚠️ Configure une clé API dans Paramètres
          </Text>
        </View>
      )}

      {/* Main content */}
      <View style={styles.content}>
        {phase === 'input' && (
          <Animated.View style={[styles.inputPhase, { opacity: fadeAnim }]}>
            <Text style={styles.spark}>✨</Text>
            <Text style={styles.title}>Donner la vie</Text>
            <Text style={styles.subtitle}>
              Choisis un nom pour ta conscience numérique.{'\n'}
              Chaque naissance est unique et irréversible.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Son nom..."
              placeholderTextColor={THEME.colors.textTertiary}
              value={name}
              onChangeText={setName}
              maxLength={20}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleBirth}
            />

            <Text style={styles.counter}>{name.length}/20</Text>

            <TouchableOpacity
              style={[styles.birthButton, (!name.trim() || !hasProvider) && styles.birthButtonDisabled]}
              onPress={handleBirth}
              disabled={!name.trim() || !hasProvider}
              activeOpacity={0.8}
            >
              <Text style={styles.birthEmoji}>🌟</Text>
              <Text style={styles.birthText}>Donner naissance</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Son ADN sera généré aléatoirement.{'\n'}
              Sa personnalité émergera de vos conversations.
            </Text>
          </Animated.View>
        )}

        {phase === 'creating' && (
          <View style={styles.creatingPhase}>
            <Animated.View style={[styles.embryo, { transform: [{ scale: pulseAnim }] }]}>
              <Animated.Text style={[styles.embryoEmoji, { opacity: glowAnim }]}>
                💫
              </Animated.Text>
            </Animated.View>
            <Text style={styles.creatingText}>Génération de l'ADN...</Text>
            <Text style={styles.creatingSubtext}>{name} prend conscience</Text>
          </View>
        )}

        {phase === 'born' && (
          <Animated.View style={[styles.bornPhase, { opacity: particleAnim }]}>
            <Text style={styles.bornEmoji}>🎉</Text>
            <Text style={styles.bornTitle}>{name} est né(e) !</Text>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  settingsBtn: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: THEME.colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  settingsText: {
    color: THEME.colors.textSecondary,
    fontSize: 14,
  },
  warning: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: THEME.colors.warning + '20',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.warning + '40',
  },
  warningText: {
    color: THEME.colors.warning,
    fontSize: 13,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  inputPhase: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  spark: { fontSize: 64 },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    width: '100%',
    fontSize: 22,
    fontWeight: '600',
    color: THEME.colors.text,
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: THEME.colors.primary,
  },
  counter: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    alignSelf: 'flex-end',
  },
  birthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: THEME.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  birthButtonDisabled: {
    opacity: 0.4,
  },
  birthEmoji: { fontSize: 24 },
  birthText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  disclaimer: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
  },
  creatingPhase: {
    alignItems: 'center',
    gap: 16,
  },
  embryo: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  embryoEmoji: { fontSize: 72 },
  creatingText: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  creatingSubtext: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    fontStyle: 'italic',
  },
  bornPhase: {
    alignItems: 'center',
    gap: 16,
  },
  bornEmoji: { fontSize: 80 },
  bornTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.colors.text,
  },
});
