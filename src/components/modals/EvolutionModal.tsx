// src/components/modals/EvolutionModal.tsx
// Modal d'évolution — affiché quand le TamadachAI change de stade

import React, { useEffect, useRef } from 'react';
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
import { EVOLUTION_STAGES } from '../../constants/evolution';
import { EvolutionStage } from '../../types';

interface EvolutionModalProps {
  visible: boolean;
  stage: EvolutionStage;
  previousStage?: EvolutionStage;
  onClose: () => void;
}

export function EvolutionModal({ visible, stage, previousStage, onClose }: EvolutionModalProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const config = (EVOLUTION_STAGES as Record<string, any>)[stage];
  const prevConfig = previousStage ? (EVOLUTION_STAGES as Record<string, any>)[previousStage] : null;

  useEffect(() => {
    if (visible) {
      Vibration.vibrate([0, 100, 100, 200, 100, 300]);

      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            Animated.timing(glowAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
          ]),
        ),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      glowAnim.setValue(0);
    }
  }, [visible]);

  if (!config) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View style={[
          styles.card,
          { transform: [{ scale: scaleAnim }] }
        ]}>
          {/* Particules / glow */}
          <Animated.View style={[styles.glow, { opacity: glowAnim }]} />

          {/* Contenu */}
          <Text style={styles.label}>✨ ÉVOLUTION ✨</Text>

          {prevConfig && (
            <View style={styles.transition}>
              <Text style={styles.prevEmoji}>{prevConfig.emoji}</Text>
              <Text style={styles.arrow}>→</Text>
              <Text style={styles.newEmoji}>{config.emoji}</Text>
            </View>
          )}

          {!prevConfig && (
            <Text style={styles.newEmoji}>{config.emoji}</Text>
          )}

          <Text style={styles.stageName}>{config.name}</Text>
          <Text style={styles.description}>{config.description}</Text>

          {/* Nouvelles capacités */}
          <View style={styles.abilities}>
            <Text style={styles.abilitiesTitle}>Nouvelles capacités</Text>
            <Text style={styles.abilityItem}>
              📝 Vocabulaire : {config.vocabulary} mots
            </Text>
            <Text style={styles.abilityItem}>
              💬 Réponse max : {config.maxResponseLength} caractères
            </Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Continuer</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    backgroundColor: THEME.colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.primary,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    bottom: -50,
    backgroundColor: THEME.colors.primary,
    opacity: 0.1,
    borderRadius: 200,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.primary,
    letterSpacing: 4,
    marginBottom: 20,
  },
  transition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  prevEmoji: {
    fontSize: 40,
    opacity: 0.5,
  },
  arrow: {
    fontSize: 24,
    color: THEME.colors.primary,
  },
  newEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  stageName: {
    fontSize: 28,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  abilities: {
    width: '100%',
    backgroundColor: THEME.colors.primary + '10',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  abilitiesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.primary,
    marginBottom: 8,
  },
  abilityItem: {
    fontSize: 13,
    color: THEME.colors.text,
    marginVertical: 3,
    lineHeight: 20,
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
