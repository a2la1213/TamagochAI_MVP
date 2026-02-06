// src/screens/LoadingScreen.tsx
// Écran de chargement avec animation

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { THEME } from '../constants/config';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'Chargement...' }: LoadingScreenProps) {
  const pulseAnim = useRef(new Animated.Value(0.5)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      }),
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[
        styles.iconContainer,
        { opacity: pulseAnim, transform: [{ rotate: spin }] }
      ]}>
        <Text style={styles.icon}>✨</Text>
      </Animated.View>
      <Animated.Text style={[styles.message, { opacity: pulseAnim }]}>
        {message}
      </Animated.Text>
      <Text style={styles.brand}>TamagochAI</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { fontSize: 48 },
  message: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
  },
  brand: {
    position: 'absolute',
    bottom: 48,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.textTertiary,
    letterSpacing: 2,
  },
});
