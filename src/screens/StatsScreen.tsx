// src/screens/StatsScreen.tsx
// Écran de statistiques détaillées — Progression, émotions, souvenirs, rêves

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTamadachiData, useEvolution, useEmotion } from '../hooks';
import { useTamadachiStore } from '../stores/useTamadachiStore';
import { THEME } from '../constants/config';
import { EVOLUTION_STAGES } from '../constants/evolution';
import { getAllDreams, getRecentDreams } from '../services/core/DreamService';
import { getRecentThoughts, getThoughtCount } from '../services/core/SubconsciousService';
import { getEmotionHistory } from '../services/core/EmotionService';
import { Dream, InternalThought } from '../types';

// ============================================================
// PROGRESS BAR COMPONENT
// ============================================================

const EMOTION_FR: Record<string, string> = {
  neutral: 'Neutre', joy: 'Joie', sadness: 'Triste', anger: 'Colère',
  fear: 'Peur', surprise: 'Surprise', love: 'Amour', curiosity: 'Curiosité',
  excitement: 'Excité', pride: 'Fierté', calm: 'Calme', anxiety: 'Anxiété',
};

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.progressBarBg}>
      <View style={[styles.progressBarFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

// ============================================================
// GENOME TRAIT BAR
// ============================================================

function GenomeTrait({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.traitRow}>
      <Text style={styles.traitLabel}>{label}</Text>
      <View style={styles.traitBarContainer}>
        <ProgressBar percent={value} color={color} />
      </View>
      <Text style={styles.traitValue}>{value}</Text>
    </View>
  );
}

// ============================================================
// ÉCRAN PRINCIPAL
// ============================================================

interface StatsScreenProps {
  onClose: () => void;
}

export function StatsScreen({ onClose }: StatsScreenProps) {
  const { tamadachi, genome, stats, emotion } = useTamadachiData();
  const { stage, totalXP } = useEvolution();
  const { emoji, primary, intensity } = useEmotion();
  const hormones = useTamadachiStore(s => s.hormones);

  const [progressData, setProgressData] = useState<any>(null);
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [thoughts, setThoughts] = useState<InternalThought[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setDreams(getRecentDreams(5));
    setThoughts(getRecentThoughts(5));
  };

  const stageConfig = EVOLUTION_STAGES[stage];
  const stageKeys = Object.keys(EVOLUTION_STAGES);
  const stageIndex = stageKeys.indexOf(stage);

  // Calcul progression dans le stade actuel
  const currentStageXP = stageConfig?.xpRequired || 0;
  const nextStageXP = stageIndex < stageKeys.length - 1
    ? EVOLUTION_STAGES[stageKeys[stageIndex + 1] as keyof typeof EVOLUTION_STAGES]?.xpRequired || Infinity
    : Infinity;
  const xpInStage = totalXP - currentStageXP;
  const xpForNext = nextStageXP - currentStageXP;
  const progressPercent = xpForNext > 0 ? Math.round((xpInStage / xpForNext) * 100) : 100;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Image
            source={require('../../assets/avatars/avatar_default.png')}
            style={{ width: 32, height: 32, borderRadius: 16 }}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Progression</Text>
        </View>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Évolution */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌱 Évolution</Text>
          <View style={styles.evolutionCard}>
            <Text style={styles.stageEmoji}>{stageConfig?.emoji || '🥚'}</Text>
            <Text style={styles.stageName}>{stageConfig?.name || stage}</Text>
            <Text style={styles.stageDescription}>{stageConfig?.description || ''}</Text>
            <View style={styles.xpContainer}>
              <Text style={styles.xpText}>{totalXP} XP</Text>
              {nextStageXP < Infinity && (
                <Text style={styles.xpNext}>→ {nextStageXP} XP</Text>
              )}
            </View>
            <ProgressBar percent={progressPercent} color={THEME.colors.primary} />
            <Text style={styles.progressText}>{progressPercent}%</Text>

            {/* Timeline des stades */}
            <View style={styles.timeline}>
              {stageKeys.map((key, idx) => {
                const cfg = EVOLUTION_STAGES[key as keyof typeof EVOLUTION_STAGES];
                const isActive = idx <= stageIndex;
                const isCurrent = idx === stageIndex;
                return (
                  <View key={key} style={styles.timelineItem}>
                    <View style={[
                      styles.timelineDot,
                      isActive && styles.timelineDotActive,
                      isCurrent && styles.timelineDotCurrent,
                    ]}>
                      <Text style={styles.timelineDotEmoji}>{cfg?.emoji || '?'}</Text>
                    </View>
                    <Text style={[styles.timelineLabel, isActive && styles.timelineLabelActive]}>
                      {cfg?.name || key}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* Génome */}
        {genome && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧬 Génome</Text>
            <View style={styles.card}>
              <GenomeTrait label="Social" value={genome.social} color="#3B82F6" />
              <GenomeTrait label="Cognitif" value={genome.cognitive} color="#8B5CF6" />
              <GenomeTrait label="Émotionnel" value={genome.emotional} color="#EF4444" />
              <GenomeTrait label="Énergie" value={genome.energy} color="#F59E0B" />
              <GenomeTrait label="Créativité" value={genome.creativity} color="#10B981" />
            </View>
          </View>
        )}

        {/* État émotionnel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💭 État actuel</Text>
          <View style={styles.card}>
            <View style={styles.emotionRow}>
              <Text style={styles.emotionEmoji}>{emoji}</Text>
              <View>
                <Text style={styles.emotionPrimary}>{EMOTION_FR[primary] || primary}</Text>
                <Text style={styles.emotionIntensity}>Intensité : {intensity}%</Text>
              </View>
            </View>
          </View>
        </View>


        {/* Hormones */}
        {hormones && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧪 Hormones</Text>
            <View style={styles.card}>
              <HormoneBar label="Dopamine" value={hormones.dopamine} color="#F59E0B" emoji="⚡" />
              <HormoneBar label="Sérotonine" value={hormones.serotonin} color="#3B82F6" emoji="☀️" />
              <HormoneBar label="Ocytocine" value={hormones.oxytocin} color="#EC4899" emoji="💕" />
              <HormoneBar label="Cortisol" value={hormones.cortisol} color="#EF4444" emoji="😰" />
              <HormoneBar label="Adrénaline" value={hormones.adrenaline} color="#F97316" emoji="🔥" />
              <HormoneBar label="Endorphines" value={hormones.endorphins} color="#10B981" emoji="😊" />
            </View>
          </View>
        )}

        {/* Statistiques */}
        {stats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📈 Statistiques</Text>
            <View style={styles.card}>
              <StatRow label="Jours de vie" value={`${stats.totalDays || 0}`} />
              <StatRow label="Messages échangés" value={`${stats.totalMessages || 0}`} />
              <StatRow label="Souvenirs créés" value={`${stats.totalMemories || 0}`} />
              <StatRow label="Streak actuel" value={`${stats.currentStreak || 0} jours 🔥`} />
              <StatRow label="Meilleur streak" value={`${stats.longestStreak || 0} jours`} />
            </View>
          </View>
        )}

        {/* Rêves récents */}
        {dreams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🌙 Rêves récents</Text>
            {dreams.map(dream => (
              <View key={dream.id} style={styles.dreamCard}>
                <View style={styles.dreamHeader}>
                  <Text style={styles.dreamTitle}>{dream.title}</Text>
                  {dream.wasShared && <Text style={styles.dreamShared}>raconté</Text>}
                </View>
                <Text selectable style={styles.dreamNarrative}>
                  {dream.narrative}
                </Text>
                <Text style={styles.dreamDate}>
                  {new Date(dream.createdAt).toLocaleDateString('fr-FR')}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Pensées récentes */}
        {thoughts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💭 Pensées internes</Text>
            {thoughts.map(thought => (
              <View key={thought.id} style={styles.thoughtCard}>
                <Text style={styles.thoughtType}>[{thought.type}]</Text>
                <Text selectable style={styles.thoughtContent}>{thought.content}</Text>
              </View>
            ))}
            <Text style={styles.thoughtCount}>
              Total : {getThoughtCount()} pensées générées
            </Text>
          </View>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// HELPER
// ============================================================


function HormoneBar({ label, value, color, emoji }: { label: string; value: number; color: string; emoji: string }) {
  const percent = Math.round(value);
  return (
    <View style={styles.hormoneRow}>
      <Text style={styles.hormoneEmoji}>{emoji}</Text>
      <Text style={styles.hormoneLabel}>{label}</Text>
      <View style={styles.hormoneBarContainer}>
        <ProgressBar percent={percent} color={color} />
      </View>
      <Text style={styles.hormoneValue}>{percent}%</Text>
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: THEME.colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: THEME.colors.text },
  closeButton: { fontSize: 24, color: THEME.colors.textSecondary, padding: 4 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: { paddingHorizontal: 20, paddingTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: THEME.colors.text, marginBottom: 12 },

  // Evolution
  evolutionCard: {
    backgroundColor: THEME.colors.surface, borderRadius: 16, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: THEME.colors.border,
  },
  stageEmoji: { fontSize: 48, marginBottom: 8 },
  stageName: { fontSize: 22, fontWeight: '700', color: THEME.colors.text, marginBottom: 4 },
  stageDescription: { fontSize: 13, color: THEME.colors.textSecondary, textAlign: 'center', marginBottom: 16, paddingHorizontal: 4 },
  xpContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  xpText: { fontSize: 18, fontWeight: '700', color: THEME.colors.primary },
  xpNext: { fontSize: 14, color: THEME.colors.textSecondary },
  progressText: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 4 },

  // Timeline
  timeline: {
    flexDirection: 'row', justifyContent: 'space-between', width: '100%',
    marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: THEME.colors.border,
  },
  timelineItem: { alignItems: 'center', flex: 1, maxWidth: 70 },
  timelineDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: THEME.colors.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  timelineDotActive: { backgroundColor: THEME.colors.primary + '30' },
  timelineDotCurrent: { backgroundColor: THEME.colors.primary, borderWidth: 2, borderColor: THEME.colors.primary },
  timelineDotEmoji: { fontSize: 16 },
  timelineLabel: { fontSize: 8, color: THEME.colors.textSecondary, textAlign: 'center', width: 60 },
  timelineLabelActive: { color: THEME.colors.text, fontWeight: '600' },

  // Cards
  card: {
    backgroundColor: THEME.colors.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: THEME.colors.border,
  },

  // Genome traits
  traitRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  traitLabel: { width: 95, fontSize: 14, color: THEME.colors.textSecondary },
  traitBarContainer: { flex: 1, marginHorizontal: 8 },
  traitValue: { width: 30, fontSize: 14, fontWeight: '600', color: THEME.colors.text, textAlign: 'right' },

  // Progress bar
  progressBarBg: { height: 8, backgroundColor: THEME.colors.border, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },

  // Emotion
  emotionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emotionEmoji: { fontSize: 36 },
  emotionPrimary: { fontSize: 18, fontWeight: '600', color: THEME.colors.text, textTransform: 'capitalize' },
  emotionIntensity: { fontSize: 13, color: THEME.colors.textSecondary },

  // Hormones
  hormoneRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  hormoneEmoji: { fontSize: 16, width: 24 },
  hormoneLabel: { width: 90, fontSize: 13, color: THEME.colors.textSecondary },
  hormoneBarContainer: { flex: 1, marginHorizontal: 6 },
  hormoneValue: { width: 36, fontSize: 13, fontWeight: '600', color: THEME.colors.text, textAlign: 'right' },

  // Stats
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statLabel: { fontSize: 14, color: THEME.colors.textSecondary, flexShrink: 0, marginRight: 12, minWidth: 140 },
  statValue: { fontSize: 14, fontWeight: '600', color: THEME.colors.text, flexShrink: 1, textAlign: 'right' },

  // Dreams
  dreamCard: {
    backgroundColor: THEME.colors.surface, borderRadius: 10, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: THEME.colors.border,
    overflow: 'visible',
  },
  dreamHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dreamTitle: { fontSize: 15, fontWeight: '600', color: THEME.colors.text },
  dreamShared: { fontSize: 11, color: THEME.colors.success },
  dreamNarrative: { fontSize: 13, color: THEME.colors.textSecondary, lineHeight: 20, fontStyle: 'italic' },
  dreamDate: { fontSize: 11, color: THEME.colors.textSecondary, marginTop: 6, opacity: 0.6 },

  // Thoughts
  thoughtCard: {
    backgroundColor: THEME.colors.surface, borderRadius: 8, padding: 10,
    marginBottom: 6, borderLeftWidth: 3, borderLeftColor: THEME.colors.primary + '60',
  },
  thoughtType: { fontSize: 10, color: THEME.colors.primary, fontWeight: '600', marginBottom: 2 },
  thoughtContent: { fontSize: 13, color: THEME.colors.text, fontStyle: 'italic', lineHeight: 19 },
  thoughtCount: { fontSize: 12, color: THEME.colors.textSecondary, marginTop: 8, textAlign: 'center' },

  footer: { height: 40 },
});
