// src/components/chat/DreamBanner.tsx
// Bandeau affiché quand le TamagochAI a un rêve à raconter

import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { THEME } from '../../constants/config';
import { Dream } from '../../types';

interface DreamBannerProps {
  dream: Dream;
  onTap: () => void;
  onDismiss: () => void;
}

export function DreamBanner({ dream, onTap, onDismiss }: DreamBannerProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(onDismiss);
  };

  return (
    <Animated.View style={[
      styles.container,
      {
        transform: [{ translateY: slideAnim }],
        opacity: fadeAnim,
      },
    ]}>
      <TouchableOpacity style={styles.content} onPress={onTap} activeOpacity={0.8}>
        <Text style={styles.icon}>🌙</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>J'ai fait un rêve...</Text>
          <Text style={styles.preview} numberOfLines={1}>
            "{dream.title}"
          </Text>
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.dismiss}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#4338CA',
  },
  icon: {
    fontSize: 24,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C7D2FE',
  },
  preview: {
    fontSize: 12,
    color: '#818CF8',
    fontStyle: 'italic',
    marginTop: 2,
  },
  dismiss: {
    fontSize: 16,
    color: '#6366F1',
    padding: 4,
  },
});
