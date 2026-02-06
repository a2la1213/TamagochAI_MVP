// src/components/modals/GenomeReveal.tsx
// Animation de révélation du génome après la naissance

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Modal,
  Vibration,
} from 'react-native';
import { THEME } from '../../constants/config';
import { Genome } from '../../types';

interface GenomeRevealProps {
  visible: boolean;
  genome: Genome;
  name: string;
  onComplete: () => void;
}

interface TraitInfo {
  key: keyof Genome;
  label: string;
  emoji: string;
  lowLabel: string;
  highLabel: string;
  color: string;
}

const TRAITS: TraitInfo[] = [
  { key: 'social', label: 'Social', emoji: '💬', lowLabel: 'Introverti', highLabel: 'Extraverti', color: '#3B82F6' },
  { key: 'cognitive', label: 'Cognitif', emoji: '🧠', lowLabel: 'Intuitif', highLabel: 'Analytique', color: '#8B5CF6' },
  { key: 'emotional', label: 'Émotionnel', emoji: '❤️', lowLabel: 'Stoïque', highLabel: 'Sensible', color: '#EC4899' },
  { key: 'energy', label: 'Énergie', emoji: '⚡', lowLabel: 'Calme', highLabel: 'Hyperactif', color: '#F59E0B' },
  { key: 'creativity', label: 'Créativité', emoji: '🎨', lowLabel: 'Pragmatique', highLabel: 'Créatif', color: '#10B981' },
];

export function GenomeReveal({ visible, genome, name, onComplete }: GenomeRevealProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const barAnims = useRef(TRAITS.map(() => new Animated.Value(0))).current;
  const labelAnims = useRef(TRAITS.map(() => new Animated.Value(0))).current;
  const [revealStep, setRevealStep] = useState(-1);

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      titleAnim.setValue(0);
      barAnims.forEach(a => a.setValue(0));
      labelAnims.forEach(a => a.setValue(0));
      setRevealStep(-1);
      return;
    }

    // Séquence d'animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    Animated.timing(titleAnim, {
      toValue: 1,
      duration: 600,
      delay: 300,
      useNativeDriver: true,
    }).start();

    // Révéler chaque trait un par un
    TRAITS.forEach((_, i) => {
      setTimeout(() => {
        setRevealStep(i);
        Vibration.vibrate(30);

        Animated.spring(barAnims[i], {
          toValue: genome[TRAITS[i].key] / 100,
          friction: 6,
          tension: 40,
          useNativeDriver: false,
        }).start();

        Animated.timing(labelAnims[i], {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 800 + i * 500);
    });
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onComplete}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <View style={styles.card}>
          {/* Titre */}
          <Animated.View style={{ opacity: titleAnim, transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
            <Text style={styles.dna}>🧬</Text>
            <Text style={styles.title}>ADN de {name}</Text>
            <Text style={styles.subtitle}>Traits uniques générés à la naissance</Text>
          </Animated.View>

          {/* Barres de traits */}
          <View style={styles.traits}>
            {TRAITS.map((trait, i) => (
              <Animated.View key={trait.key} style={[styles.traitRow, { opacity: labelAnims[i] }]}>
                <View style={styles.traitHeader}>
                  <Text style={styles.traitEmoji}>{trait.emoji}</Text>
                  <Text style={styles.traitLabel}>{trait.label}</Text>
                  <Text style={styles.traitValue}>{genome[trait.key]}</Text>
                </View>
                <View style={styles.barContainer}>
                  <Animated.View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: trait.color,
                        width: barAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>
                <View style={styles.traitScale}>
                  <Text style={styles.scaleLabel}>{trait.lowLabel}</Text>
                  <Text style={styles.scaleLabel}>{trait.highLabel}</Text>
                </View>
              </Animated.View>
            ))}
          </View>

          {/* Bouton continuer — visible après toutes les animations */}
          {revealStep >= TRAITS.length - 1 && (
            <TouchableOpacity style={styles.button} onPress={onComplete}>
              <Text style={styles.buttonText}>Découvrir {name}</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: THEME.colors.surface,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  dna: { fontSize: 48, marginBottom: 8 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  traits: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },
  traitRow: {},
  traitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  traitEmoji: { fontSize: 16, marginRight: 6 },
  traitLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  traitValue: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  barContainer: {
    width: '100%',
    height: 8,
    backgroundColor: THEME.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  traitScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  scaleLabel: {
    fontSize: 10,
    color: THEME.colors.textTertiary,
  },
  button: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
