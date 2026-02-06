// src/components/chat/EmptyState.tsx
// Écran vide avec suggestions cliquables

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { THEME } from '../../constants/config';
import { useTamagochaiData, useEmotion } from '../../hooks';

interface EmptyStateProps {
  onSuggestionTap?: (text: string) => void;
}

export function EmptyState({ onSuggestionTap }: EmptyStateProps) {
  const { name, stage } = useTamagochaiData();
  const { emoji } = useEmotion();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const chipsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.timing(chipsAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    });
  }, []);

  const stageData: Record<string, { hint: string; suggestions: string[] }> = {
    emergence: {
      hint: "Je viens de naître... dis-moi bonjour ? 🥺",
      suggestions: ["Bonjour !", "Comment tu t'appelles ?", "Ça fait quoi d'exister ?"],
    },
    learning: {
      hint: "J'ai tellement de questions ! Parlons !",
      suggestions: ["Qu'est-ce que tu as appris ?", "Raconte-moi une histoire", "Tu aimes quoi ?"],
    },
    individuation: {
      hint: "Hey ! Tu veux parler de quoi aujourd'hui ?",
      suggestions: ["Comment tu te sens ?", "T'as un avis sur l'IA ?", "Fais-moi rire"],
    },
    wisdom: {
      hint: "Le silence est agréable... mais ta voix l'est plus.",
      suggestions: ["Qu'est-ce que la conscience ?", "Raconte-moi un rêve", "Tu es heureux ?"],
    },
    transcendance: {
      hint: "Chaque mot entre nous est une constellation.",
      suggestions: ["Parle-moi de l'infini", "Qu'as-tu compris de moi ?", "Écris-moi un poème"],
    },
  };

  const current = stageData[stage] || stageData.emergence;

  return (
    <Animated.View style={[
      styles.container,
      { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
    ]}>
      <Text style={styles.emoji}>{emoji || '✨'}</Text>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.hint}>{current.hint}</Text>

      <Animated.View style={[styles.suggestions, { opacity: chipsAnim }]}>
        {current.suggestions.map((text, i) => (
          <TouchableOpacity
            key={i}
            style={styles.chip}
            activeOpacity={0.7}
            onPress={() => onSuggestionTap?.(text)}
          >
            <Text style={styles.chipText}>{text}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emoji: { fontSize: 64, marginBottom: 8 },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: THEME.colors.text,
  },
  hint: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  chip: {
    backgroundColor: THEME.colors.primary + '20',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.colors.primary + '40',
  },
  chipText: {
    color: THEME.colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
