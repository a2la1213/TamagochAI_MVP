// src/components/avatar/TamagochaiAvatar.tsx
// Avatar animé du TamagochAI
// Réagit aux émotions, au stade d'évolution et à la batterie

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useEmotion, useBattery, useEvolution, useTamagochaiData } from '../../hooks';
import { THEME } from '../../constants/config';
import { EVOLUTION_STAGES } from '../../constants/evolution';
import { EMOTION_CONFIGS } from '../../constants/emotions';

interface AvatarProps {
  size?: number;
  showLabel?: boolean;
}

export function TamagochaiAvatar({ size = 120, showLabel = true }: AvatarProps) {
  const { primary, intensity, emoji: emotionEmoji } = useEmotion();
  const { percent, isCharging } = useBattery();
  const { stage } = useEvolution();
  const { name } = useTamagochaiData();

  // Animations
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const stageConfig = EVOLUTION_STAGES[stage];
  const emotionConfig = EMOTION_CONFIGS[primary] || EMOTION_CONFIGS.neutral;

  // Animation de respiration (idle)
  useEffect(() => {
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.05,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    breathing.start();
    return () => breathing.stop();
  }, []);

  // Glow basé sur l'intensité émotionnelle
  useEffect(() => {
    Animated.timing(glowAnim, {
      toValue: Math.max(0.3, intensity / 100),
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [intensity]);

  // Shake quand batterie critique
  useEffect(() => {
    if (percent <= 10 && !isCharging) {
      const shake = Animated.loop(
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 3, duration: 100, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -3, duration: 100, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
          Animated.delay(2000),
        ]),
      );
      shake.start();
      return () => shake.stop();
    } else {
      shakeAnim.setValue(0);
    }
  }, [percent, isCharging]);

  // Couleur de fond basée sur l'émotion
  const bgColor = emotionConfig?.color || '#3B82F6';

  // Expression faciale basée sur l'émotion
  const expression = getExpression(primary, intensity, percent, isCharging);

  return (
    <View style={styles.container}>
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size + 40,
            height: size + 40,
            borderRadius: (size + 40) / 2,
            backgroundColor: bgColor,
            opacity: glowAnim,
          },
        ]}
      />

      {/* Avatar principal */}
      <Animated.View
        style={[
          styles.avatarContainer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor + '20',
            borderColor: bgColor,
            transform: [
              { scale: bounceAnim },
              { translateX: shakeAnim },
            ],
          },
        ]}
      >
        {/* Stade emoji */}
        <Text style={[styles.stageEmoji, { fontSize: size * 0.45 }]}>
          {stageConfig?.emoji || '🥚'}
        </Text>

        {/* Expression */}
        <Text style={[styles.expression, { fontSize: size * 0.15 }]}>
          {expression}
        </Text>
      </Animated.View>

      {/* Labels */}
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={styles.nameLabel}>{name}</Text>
          <View style={styles.statusRow}>
            <Text style={styles.emotionLabel}>{emotionEmoji} {primary}</Text>
            <Text style={styles.batteryLabel}>
              {isCharging ? '⚡' : '🔋'} {percent}%
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================
// EXPRESSIONS
// ============================================================

function getExpression(
  emotion: string,
  intensity: number,
  battery: number,
  charging: boolean,
): string {
  // Batterie critique override tout
  if (battery <= 5 && !charging) return '😵';
  if (battery <= 10 && !charging) return '😰';

  // Charge → content
  if (charging && battery < 90) return '😌';
  if (charging && battery >= 90) return '😊';

  // Expressions par émotion et intensité
  const expressions: Record<string, [string, string, string]> = {
    // [low, mid, high intensity]
    joy:       ['🙂', '😊', '😄'],
    sadness:   ['😐', '😔', '😢'],
    anger:     ['😑', '😤', '😡'],
    fear:      ['😟', '😨', '😱'],
    love:      ['🥰', '💕', '❤️‍🔥'],
    surprise:  ['😮', '😲', '🤯'],
    curiosity: ['🤔', '🧐', '✨'],
    neutral:   ['😐', '🙂', '😊'],
  };

  const set = expressions[emotion] || expressions.neutral;
  if (intensity < 33) return set[0];
  if (intensity < 66) return set[1];
  return set[2];
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  avatarContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  stageEmoji: {
    textAlign: 'center',
  },
  expression: {
    position: 'absolute',
    bottom: '15%',
    textAlign: 'center',
  },
  labelContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  nameLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
  },
  emotionLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textTransform: 'capitalize',
  },
  batteryLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
});
