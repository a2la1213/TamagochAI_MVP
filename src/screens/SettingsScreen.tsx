// src/screens/SettingsScreen.tsx
// Écran de paramètres — Configuration LLM, stats, debug

import React, { useState, useEffect, useCallback, useReducer } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings, useTamadachiData, useEvolution } from '../hooks';
import { THEME, LLM_CONFIG } from '../constants/config';
import { LLMProviderName } from '../types';

// ============================================================
// COMPOSANTS INTERNES
// ============================================================

function ProviderCard({
  provider,
  onSetKey,
  onSelect,
  onSetModel,
}: {
  provider: {
    name: LLMProviderName;
    label: string;
    model: string;
    isConfigured: boolean;
    isPreferred: boolean;
  };
  onSetKey: (name: LLMProviderName, key: string) => Promise<boolean>;
  onSelect: (name: LLMProviderName) => void;
  onSetModel: (name: LLMProviderName, model: string) => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    const success = await onSetKey(provider.name, apiKey.trim());
    setIsSaving(false);
    if (success) {
      Alert.alert('✅ Clé valide', `${provider.label} est maintenant disponible.`);
      setIsEditing(false);
      setApiKey('');
    } else {
      Alert.alert('❌ Clé invalide', 'Vérifie ta clé API et réessaie.');
    }
  };

  return (
    <View style={[styles.providerCard, provider.isPreferred && styles.providerCardPreferred]}>
      <View style={styles.providerHeader}>
        <View style={styles.providerInfo}>
          <Text style={styles.providerName}>{provider.label}</Text>
          <Text style={styles.providerModel}>{provider.model}</Text>
          {/* Sélecteur de modèle */}
          {provider.isConfigured && (LLM_CONFIG.providers as any)[provider.name]?.models?.length > 1 && (
            <View style={styles.modelSelector}>
              {(LLM_CONFIG.providers as any)[provider.name].models.map((model: string) => (
                <TouchableOpacity
                  key={model}
                  style={[
                    styles.modelChip,
                    provider.model === model && styles.modelChipActive,
                  ]}
                  onPress={() => onSetModel(provider.name, model)}
                >
                  <Text style={[
                    styles.modelChipText,
                    provider.model === model && styles.modelChipTextActive,
                  ]}>
                    {model.replace('gemini-2.0-', '').replace('gemini-1.5-', '1.5-').replace('claude-sonnet-4-5-20250929', 'Sonnet 4.5').replace('claude-haiku-4-5-20251001', 'Haiku 4.5').replace('gpt-4o-mini', '4o-mini').replace('gpt-4o', '4o')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={styles.providerBadges}>
          {provider.isConfigured && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>✅</Text>
            </View>
          )}
          {provider.isPreferred && (
            <View style={[styles.badge, styles.badgePreferred]}>
              <Text style={styles.badgeText}>⭐</Text>
            </View>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.providerActions}>
        {provider.isConfigured && !provider.isPreferred && (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => onSelect(provider.name)}
          >
            <Text style={styles.selectButtonText}>Utiliser</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.keyButton}
          onPress={() => setIsEditing(!isEditing)}
        >
          <Text style={styles.keyButtonText}>
            {provider.isConfigured ? 'Changer la clé' : 'Ajouter clé API'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Édition de la clé */}
      {isEditing && (
        <View style={styles.keyEditContainer}>
          <TextInput
            style={styles.keyInput}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="sk-... ou AIza..."
            placeholderTextColor={THEME.colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.saveKeyButton, !apiKey.trim() && styles.buttonDisabled]}
            onPress={handleSaveKey}
            disabled={!apiKey.trim() || isSaving}
          >
            <Text style={styles.saveKeyButtonText}>
              {isSaving ? '...' : 'Valider'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ============================================================
// ÉCRAN PRINCIPAL
// ============================================================

interface SettingsScreenProps {
  onClose: () => void;
}

export function SettingsScreen({ onClose }: SettingsScreenProps) {
  const { setApiKey, setPreferredProvider, setProviderModel, setXPMode, getLLMInfo } = useSettings();
  const { tamadachi, genome } = useTamadachiData();
  const { stage, totalXP } = useEvolution();

  const [refreshKey, setRefreshKey] = React.useState(0);
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const llmInfo = getLLMInfo();

  // Rafraîchir les stats toutes les 5s quand l'écran est ouvert
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectProvider = async (name: LLMProviderName) => {
    await setPreferredProvider(name);
    setRefreshKey(k => k + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* Section TamadachAI */}
        {tamadachi && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🧬 Mon TamadachAI</Text>
            <View style={styles.infoCard}>
              <InfoRow label="Nom" value={tamadachi.name} />
              <InfoRow label="Stade" value={`${stage} (${totalXP} XP)`} />
              <InfoRow label="Jours de vie" value={`${tamadachi.stats?.totalDays || 0}`} />
              <InfoRow label="Messages échangés" value={`${tamadachi.stats?.totalMessages || 0}`} />
              {genome && (
                <>
                  <View style={styles.separator} />
                  <Text style={styles.genomeTitle}>Génome</Text>
                  <InfoRow label="Social" value={`${genome.social}/100`} />
                  <InfoRow label="Cognitif" value={`${genome.cognitive}/100`} />
                  <InfoRow label="Émotionnel" value={`${genome.emotional}/100`} />
                  <InfoRow label="Énergie" value={`${genome.energy}/100`} />
                  <InfoRow label="Créativité" value={`${genome.creativity}/100`} />
                </>
              )}
            </View>
          </View>
        )}

        {/* Section Providers LLM */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 Providers LLM</Text>
          <Text style={styles.sectionDescription}>
            Configure au moins un provider pour que ton TamadachAI puisse te parler.
            
            🚀 Groq est recommandé (gratuit, ultra rapide) :
            1. Va sur console.groq.com
            2. Crée un compte (Google/GitHub)  
            3. Clique 'Create API Key'
            4. Copie la clé ici

          </Text>
          {llmInfo.all.map((provider: any) => (
            <ProviderCard
              key={provider.name}
              provider={provider}
              onSetKey={setApiKey}
              onSelect={handleSelectProvider}
              onSetModel={setProviderModel}
            />
          ))}
        </View>

        {/* Section LLM Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Statistiques LLM</Text>
          <View style={styles.infoCard}>
            <InfoRow label="Requêtes totales" value={`${llmInfo.stats.totalRequests}`} />
            <InfoRow label="Tokens utilisés" value={`${llmInfo.stats.totalTokens}`} />
            <InfoRow label="Latence moyenne" value={`${llmInfo.stats.averageLatencyMs}ms`} />
            <InfoRow label="Taux de succès" value={`${llmInfo.stats.successRate}%`} />
            <InfoRow label="Dernier provider" value={llmInfo.stats.lastProvider || '-'} />
          </View>
        </View>

        {/* Section Debug */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔧 Debug</Text>
          <View style={styles.debugButtons}>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => {
                setXPMode('prototype');
                Alert.alert('XP Mode', 'Mode Prototype (x3) activé');
              }}
            >
              <Text style={styles.debugButtonText}>XP x3</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => {
                setXPMode('debug');
                Alert.alert('XP Mode', 'Mode Debug (x50) activé');
              }}
            >
              <Text style={styles.debugButtonText}>XP x50</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.debugButton, styles.debugButtonProd]}
              onPress={() => {
                setXPMode('production');
                Alert.alert('XP Mode', 'Mode Production (x1) activé');
              }}
            >
              <Text style={styles.debugButtonText}>XP x1</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>TamadachAI</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// COMPOSANT HELPER
// ============================================================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.colors.text,
  },
  closeButton: {
    fontSize: 24,
    color: THEME.colors.textSecondary,
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  // Provider Card
  providerCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  providerCardPreferred: {
    borderColor: THEME.colors.primary,
    borderWidth: 2,
  },
  providerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  modelSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  modelChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: THEME.colors.surface,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  modelChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  modelChipText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
  },
  modelChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  providerModel: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  providerBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePreferred: {
    backgroundColor: THEME.colors.primary + '20',
  },
  badgeText: {
    fontSize: 14,
  },
  providerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  selectButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  keyButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    borderRadius: 8,
  },
  keyButtonText: {
    color: THEME.colors.textSecondary,
    fontSize: 13,
  },
  keyEditContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  keyInput: {
    flex: 1,
    height: 40,
    backgroundColor: THEME.colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  saveKeyButton: {
    paddingHorizontal: 16,
    height: 40,
    backgroundColor: THEME.colors.success,
    borderRadius: 8,
    justifyContent: 'center',
  },
  saveKeyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Info Card
  infoCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    flexShrink: 0,
    minWidth: 160,
    marginRight: 12,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: THEME.colors.border,
    marginVertical: 8,
  },
  genomeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 4,
  },
  // Debug
  debugButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  debugButton: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: THEME.colors.warning + '30',
    borderRadius: 8,
    alignItems: 'center',
  },
  debugButtonProd: {
    backgroundColor: THEME.colors.success + '30',
  },
  debugButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  // Footer
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
    width: '100%',
  },
  footerText: {
    fontSize: 16,
    color: THEME.colors.textSecondary,
    opacity: 0.5,
    letterSpacing: 2,
    textAlign: 'center',
  },
});
