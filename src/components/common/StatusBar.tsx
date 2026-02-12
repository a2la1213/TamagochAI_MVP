// src/components/common/StatusBar.tsx
// Barre de statut — affiche l'émotion, la batterie et l'XP

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useEmotion, useBattery, useEvolution } from '../../hooks';
import { THEME } from '../../constants/config';
import { EVOLUTION_STAGES } from '../../constants/evolution';

const EMOTION_FR: Record<string, string> = {
  neutral: 'Neutre',
  joy: 'Joie',
  sadness: 'Triste',
  anger: 'Colère',
  fear: 'Peur',
  surprise: 'Surprise',
  disgust: 'Dégoût',
  love: 'Amour',
  curiosity: 'Curiosité',
  confusion: 'Confusion',
  excitement: 'Excité',
  pride: 'Fierté',
  shame: 'Honte',
  anxiety: 'Anxiété',
  calm: 'Calme',
  melancholy: 'Mélancolie',
};

export function StatusBar() {
  const { emoji, primary } = useEmotion();
  const { percent, isCharging } = useBattery();
  const { stage, totalXP } = useEvolution();

  const stageConfig = EVOLUTION_STAGES[stage];

  return (
    <View style={styles.container}>
      {/* Émotion */}
      <View style={styles.item}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.label}>{EMOTION_FR[primary] || primary}</Text>
      </View>

      {/* Stade + XP */}
      <View style={styles.centerItem}>
        <Text style={styles.stageEmoji}>{stageConfig.emoji}</Text>
        <Text style={styles.xpText}>{totalXP} XP</Text>
      </View>

      {/* Batterie */}
      <View style={styles.itemRight}>
        <Text style={styles.emoji}>{isCharging ? '⚡' : '🔋'}</Text>
        <Text style={[styles.label, percent <= 15 && styles.criticalText]}>
          {percent}%
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: THEME.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  centerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emoji: {
    fontSize: 18,
  },
  stageEmoji: {
    fontSize: 16,
  },
  label: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    flexShrink: 0,
    minWidth: 50,
  },
  xpText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  labelRight: {
    textAlign: 'right',
  },
  criticalText: {
    color: THEME.colors.error,
    fontWeight: 'bold',
  },
});
