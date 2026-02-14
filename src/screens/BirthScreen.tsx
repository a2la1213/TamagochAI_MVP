// src/screens/BirthScreen.tsx
// Écran de naissance — Sélection avatar + Animation œuf qui éclot

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
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../constants/config';
import { useTamadachiStore } from '../stores/useTamadachiStore';
import { analyzePersonality } from '../services/core/PersonalityService';
import { GenomeReveal } from '../components/modals/GenomeReveal';
import { SettingsScreen } from './SettingsScreen';
import { Genome } from '../types';
import { getAvailableProviders } from '../services/llm/LLMOrchestrator';

type Phase = 'input' | 'egg_idle' | 'egg_shake' | 'egg_crack' | 'hatch' | 'genome' | 'done';

// Avatar images — require() pour le bundler
const AVATAR_IMAGES: Record<string, any> = {
  animal: require('../../assets/avatars/animal.png'),
  cyborg: require('../../assets/avatars/cyborg.png'),
  human: require('../../assets/avatars/human.png'),
  elf: require('../../assets/avatars/elf.png'),
  ghost: require('../../assets/avatars/ghost.png'),
};

const AVATAR_CHOICES = [
  { type: 'animal', emoji: '🦊', label: 'Animal', color: '#F59E0B', hasImage: true, imageKey: 'animal' as const },
  { type: 'robot', emoji: '🤖', label: 'Cyborg', color: '#3B82F6', hasImage: true, imageKey: 'cyborg' as const },
  { type: 'humanoid', emoji: '🧑', label: 'Humain', color: '#EF4444', hasImage: true, imageKey: 'human' as const },
  { type: 'creature', emoji: '🧝', label: 'Elfe', color: '#10B981', hasImage: true, imageKey: 'elf' as const },
  { type: 'spirit', emoji: '👻', label: 'Fantôme', color: '#8B5CF6', hasImage: true, imageKey: 'ghost' as const },
  { type: 'abstract', emoji: '✨', label: 'Abstrait', color: '#6366F1', hasImage: false, imageKey: null },
];

export function BirthScreen({ onAnimStart, onAnimEnd }: { onAnimStart?: () => void; onAnimEnd?: () => void }) {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_CHOICES[0]);
  const [phase, setPhase] = useState<Phase>('input');
  const [showSettings, setShowSettings] = useState(false);
  const [genome, setGenome] = useState<Genome | null>(null);
  const [birthMessage, setBirthMessage] = useState('');
  const [archetype, setArchetype] = useState('');

  // Animations
  const eggShake = useRef(new Animated.Value(0)).current;
  const eggScale = useRef(new Animated.Value(1)).current;
  const crackOpacity = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0)).current;
  const avatarY = useRef(new Animated.Value(30)).current;
  const eggOpacity = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    Array.from({ length: 8 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  const createTamadachi = useTamadachiStore(s => s.createTamadachi);
  const hasProvider = getAvailableProviders().length > 0;

  // ============================================================
  // EGG HATCHING ANIMATION SEQUENCE
  // ============================================================
  const runHatchAnimation = async () => {
    // Phase 1: Egg appears and shakes gently (2s)
    setPhase('egg_idle');
    await new Promise(r => setTimeout(r, 500));

    // Phase 2: Egg shakes more intensely (2s)
    setPhase('egg_shake');
    const shakeSequence = Animated.loop(
      Animated.sequence([
        Animated.timing(eggShake, { toValue: 8, duration: 80, useNativeDriver: true }),
        Animated.timing(eggShake, { toValue: -8, duration: 80, useNativeDriver: true }),
        Animated.timing(eggShake, { toValue: 5, duration: 60, useNativeDriver: true }),
        Animated.timing(eggShake, { toValue: -5, duration: 60, useNativeDriver: true }),
        Animated.timing(eggShake, { toValue: 0, duration: 50, useNativeDriver: true }),
        Animated.delay(400),
      ]),
    );
    shakeSequence.start();
    Vibration.vibrate([0, 30, 80, 30, 80, 50]);

    await new Promise(r => setTimeout(r, 2000));

    // Phase 3: Crack appears
    setPhase('egg_crack');
    shakeSequence.stop();
    Animated.parallel([
      Animated.timing(crackOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(eggScale, { toValue: 1.15, duration: 200, useNativeDriver: true }),
        Animated.timing(eggScale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
    Vibration.vibrate([0, 100, 50, 100]);

    await new Promise(r => setTimeout(r, 1000));

    // Phase 4: HATCH! Egg disappears, avatar appears with particles
    setPhase('hatch');
    Vibration.vibrate([0, 200, 100, 400]);

    // Egg disappears
    Animated.timing(eggOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();

    // Avatar springs up
    Animated.parallel([
      Animated.spring(avatarScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
      Animated.spring(avatarY, { toValue: 0, friction: 5, tension: 60, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start();

    // Particles explode outward
    const angles = [0, 45, 90, 135, 180, 225, 270, 315];
    particleAnims.forEach((p, i) => {
      const angle = (angles[i] * Math.PI) / 180;
      const dist = 80 + Math.random() * 40;
      Animated.parallel([
        Animated.timing(p.x, { toValue: Math.cos(angle) * dist, duration: 600, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * dist, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(p.opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(p.scale, { toValue: 1.5, duration: 200, useNativeDriver: true }),
          Animated.timing(p.scale, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
      ]).start();
    });
  };

  const handleBirth = async () => {
    if (!name.trim()) return;
    Keyboard.dismiss();

    try {
      // Start egg animation — block chat transition
      onAnimStart?.();
      runHatchAnimation();

      // Create in background
      await createTamadachi(name.trim(), selectedAvatar.type);

      // Wait for hatch animation to finish
      await new Promise(r => setTimeout(r, 5000));

      // Compute archetype
      const state = useTamadachiStore.getState();
      if (state.tamadachi?.genome) {
        const personality = analyzePersonality(state.tamadachi.genome);
        setArchetype(personality.archetype);
        setBirthMessage(
          name + ', ton TamadachAI ' + personality.archetype + ' est ne ! Prends-en soin, il a besoin de toi.'
        );
        setGenome(state.tamadachi.genome);

        // Laisser le message de naissance visible 4 secondes
        await new Promise(r => setTimeout(r, 4000));

        // Puis montrer le genome
        setPhase('genome');
      } else {
        setPhase('done');
        onAnimEnd?.();
      }
    } catch (error) {
      setPhase('input');
    }
  };

  if (showSettings) {
    return <SettingsScreen onClose={() => setShowSettings(false)} />;
  }

  if (phase === 'genome' && genome) {
    return (
      <GenomeReveal
        visible
        genome={genome}
        name={name}
        archetype={archetype}
        onComplete={() => { setPhase('done'); onAnimEnd?.(); }}
      />
    );
  }

  // ============================================================
  // EGG / HATCH PHASES
  // ============================================================
  if (phase !== 'input') {
    const eggEmojis = ['🥚', '🥚', '🪺', '🪺'];
    const phaseIdx = ['egg_idle', 'egg_shake', 'egg_crack', 'hatch'].indexOf(phase);
    // egg visibility handled by Animated opacity

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.hatchContainer}>
          {/* Glow behind */}
          <Animated.View
            style={[
              styles.hatchGlow,
              {
                backgroundColor: selectedAvatar.color,
                opacity: glowAnim,
                transform: [{ scale: Animated.add(glowAnim, 1) }],
              },
            ]}
          />

          {/* Egg */}
          <Animated.View
            style={{
              opacity: eggOpacity,
              transform: [
                { translateX: eggShake },
                { scale: eggScale },
              ],
            }}
          >
            <Text style={styles.eggEmoji}>
              {phase === 'egg_crack' ? '🪺' : '🥚'}
            </Text>
            {phase === 'egg_crack' && (
              <Animated.Text style={[styles.crackEmoji, { opacity: crackOpacity }]}>
                💥
              </Animated.Text>
            )}
          </Animated.View>

          {/* Avatar appearing */}
          <Animated.View
            style={[
              styles.avatarReveal,
              {
                transform: [
                  { scale: avatarScale },
                  { translateY: avatarY },
                ],
              },
            ]}
          >
            {selectedAvatar.hasImage && selectedAvatar.imageKey ? (
              <Image
                source={AVATAR_IMAGES[selectedAvatar.imageKey]}
                style={styles.avatarRevealImage}
                resizeMode="contain"
              />
            ) : (
              <Text style={styles.avatarEmoji}>{selectedAvatar.emoji}</Text>
            )}
          </Animated.View>

          {/* Particles */}
          {particleAnims.map((p, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.particle,
                {
                  opacity: p.opacity,
                  transform: [
                    { translateX: p.x },
                    { translateY: p.y },
                    { scale: p.scale },
                  ],
                },
              ]}
            >
              {['✨', '⭐', '💫', '🌟', '✨', '⭐', '💫', '🌟'][i]}
            </Animated.Text>
          ))}

          {/* Status text */}
          <Text style={styles.hatchText}>
            {phase === 'egg_idle' && 'L\'œuf frémit...'}
            {phase === 'egg_shake' && 'Quelque chose bouge !'}
            {phase === 'egg_crack' && 'Ça craque !'}
            {phase === 'hatch' && (birthMessage || name + ' est ne(e) ! \u{1F389}')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================================
  // INPUT PHASE
  // ============================================================
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => setShowSettings(true)}
      >
        <Text style={styles.settingsText}>⚙️</Text>
      </TouchableOpacity>

      {!hasProvider && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            ⚠️ Configure une clé API dans ⚙️ Paramètres
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.spark}>✨</Text>
        <Text style={styles.title}>Donner la vie</Text>
        <Text style={styles.subtitle}>
          Choisis un nom et un avatar pour ta conscience numérique.
        </Text>

        {/* Name input */}
        <TextInput
          style={styles.input}
          placeholder="Son nom..."
          placeholderTextColor={THEME.colors.textTertiary}
          value={name}
          onChangeText={setName}
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={handleBirth}
        />
        <Text style={styles.counter}>{name.length}/20</Text>

        {/* Avatar selection */}
        <Text style={styles.avatarTitle}>Choisis son apparence</Text>
        <View style={styles.avatarGrid}>
          {AVATAR_CHOICES.map((av) => (
            <TouchableOpacity
              key={av.type}
              style={[
                styles.avatarOption,
                selectedAvatar.type === av.type && [
                  styles.avatarOptionSelected,
                  { borderColor: av.color },
                ],
              ]}
              onPress={() => setSelectedAvatar(av)}
              activeOpacity={0.7}
            >
              {av.hasImage && av.imageKey ? (
                <Image
                  source={AVATAR_IMAGES[av.imageKey]}
                  style={styles.avatarOptionImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.avatarOptionEmoji}>{av.emoji}</Text>
              )}
              <Text
                style={[
                  styles.avatarOptionLabel,
                  selectedAvatar.type === av.type && { color: av.color },
                ]}
              >
                {av.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Birth button */}
        <TouchableOpacity
          style={[
            styles.birthButton,
            { backgroundColor: selectedAvatar.color },
            (!name.trim() || !hasProvider) && styles.birthButtonDisabled,
          ]}
          onPress={handleBirth}
          disabled={!name.trim() || !hasProvider}
          activeOpacity={0.8}
        >
          <Text style={styles.birthEmoji}>🥚</Text>
          <Text style={styles.birthText}>Donner naissance</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Son ADN sera généré aléatoirement.{' '}
          Sa personnalité émergera de vos conversations.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  settingsBtn: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsText: { fontSize: 20 },
  warning: {
    marginHorizontal: 16,
    marginTop: 100,
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
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  spark: { fontSize: 56, marginBottom: 8 },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  input: {
    width: '100%',
    fontSize: 22,
    fontWeight: '600',
    color: THEME.colors.text,
    textAlign: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: THEME.colors.primary,
  },
  counter: {
    fontSize: 12,
    color: THEME.colors.textTertiary,
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  avatarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 12,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  avatarOption: {
    width: 95,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    backgroundColor: THEME.colors.surface,
    borderWidth: 2,
  },
  avatarOptionEmoji: { fontSize: 32, marginBottom: 4 },
  avatarOptionImage: { width: 50, height: 50, marginBottom: 4 },
  avatarOptionLabel: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  birthButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  birthButtonDisabled: { opacity: 0.4 },
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
    marginTop: 16,
  },
  // Hatch animation
  hatchContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hatchGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  eggEmoji: { fontSize: 100 },
  crackEmoji: {
    fontSize: 40,
    position: 'absolute',
    top: -10,
    right: -10,
  },
  avatarReveal: {
    position: 'absolute',
  },
  avatarEmoji: { fontSize: 80 },
  avatarRevealImage: { width: 120, height: 120 },
  particle: {
    position: 'absolute',
    fontSize: 24,
  },
  hatchText: {
    position: 'absolute',
    bottom: 120,
    fontSize: 22,
    fontWeight: '600',
    color: THEME.colors.text,
    textAlign: 'center',
  },
});
