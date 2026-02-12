// src/components/avatar/TamadachiAvatar.tsx
// Avatar animé du TamadachAI — avec images réelles

import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { useEmotion, useBattery, useEvolution, useTamadachiData } from '../../hooks';
import { THEME } from '../../constants/config';
import { EVOLUTION_STAGES } from '../../constants/evolution';
import { EMOTION_CONFIGS } from '../../constants/emotions';
import { getAvatarImage } from '../../constants/avatar';

interface AvatarProps {
  size?: number;
  showLabel?: boolean;
}

export function TamadachiAvatar({ size = 120, showLabel = true }: AvatarProps) {
  const { primary, intensity, emoji: emotionEmoji } = useEmotion();
  const { percent, isCharging } = useBattery();
  const { stage } = useEvolution();
  const { name, avatar } = useTamadachiData();

  // Animations
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const stageConfig = EVOLUTION_STAGES[stage];
  const emotionConfig = EMOTION_CONFIGS[primary] || EMOTION_CONFIGS.neutral;
  const avatarImage = getAvatarImage(avatar?.type || 'animal');

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

  // Glow basé sur l\'intensité émotionnelle
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

  const bgColor = emotionConfig?.color || '#3B82F6';

  return (
    <View style={styles.container}>
      {/* Glow effect */}
      <Animated.View
        style={[
          styles.glow,
          {
            width: size + 30,
            height: size + 30,
            borderRadius: (size + 30) / 2,
            backgroundColor: bgColor,
            opacity: glowAnim,
          },
        ]}
      />

      {/* Avatar image */}
      <Animated.View
        style={{
          transform: [
            { scale: bounceAnim },
            { translateX: shakeAnim },
          ],
        }}
      >
        <Image
          source={avatarImage}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Labels */}
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={styles.nameLabel}>{name}</Text>
          <Text style={styles.hintLabel}>{stageConfig?.description || ''}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
  },
  labelContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  nameLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  hintLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
});
