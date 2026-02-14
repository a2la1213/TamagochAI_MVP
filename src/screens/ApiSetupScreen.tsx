// src/screens/ApiSetupScreen.tsx
// Écran d'onboarding — Configuration de la clé API au premier lancement

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Linking, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME } from '../constants/config';
import { setApiKey, setPreferredProvider } from '../services/llm/LLMOrchestrator';

interface Props {
  onComplete: () => void;
}

type ProviderChoice = 'groq' | 'gemini' | 'claude' | 'openai' | 'deepseek';

const PROVIDERS: Array<{
  id: ProviderChoice;
  name: string;
  icon: string;
  free: boolean;
  model: string;
  url: string;
  steps: string[];
}> = [
  {
    id: 'groq',
    name: 'Groq',
    icon: '🚀',
    free: true,
    model: 'llama-4-scout',
    url: 'https://console.groq.com/keys',
    steps: [
      '1. Va sur console.groq.com',
      '2. Crée un compte (Google ou GitHub)',
      '3. Clique sur "Create API Key"',
      '4. Donne un nom (ex: TamadachAI)',
      '5. Copie la clé et colle-la ici',
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '⚡',
    free: false,
    model: 'gemini-2.0-flash-lite',
    url: 'https://aistudio.google.com/apikey',
    steps: [
      '1. Va sur aistudio.google.com/apikey',
      '2. Connecte-toi avec ton compte Google',
      '3. Clique sur "Create API Key"',
      '4. Copie la clé et colle-la ici',
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    icon: '🟣',
    free: false,
    model: 'claude-sonnet-4-5-20250929',
    url: 'https://console.anthropic.com/settings/keys',
    steps: [
      '1. Va sur console.anthropic.com',
      '2. Crée un compte (5$ de crédits offerts)',
      '3. Va dans Settings → API Keys',
      '4. Crée une clé et colle-la ici',
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    free: false,
    model: 'gpt-4o',
    url: 'https://platform.openai.com/api-keys',
    steps: [
      '1. Va sur platform.openai.com',
      '2. Crée un compte et ajoute du crédit',
      '3. Va dans API Keys',
      '4. Crée une clé et colle-la ici',
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '🔵',
    free: false,
    model: 'deepseek-chat',
    url: 'https://platform.deepseek.com/api_keys',
    steps: [
      '1. Va sur platform.deepseek.com',
      '2. Crée un compte (crédits offerts)',
      '3. Va dans API Keys',
      '4. Crée une clé et colle-la ici',
    ],
  },
];

export function ApiSetupScreen({ onComplete }: Props) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderChoice>('groq');
  const [key, setKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  const provider = PROVIDERS.find(p => p.id === selectedProvider)!;

  const handleTest = async () => {
    if (!key.trim()) return;
    setTesting(true);
    try {
      const success = await setApiKey(selectedProvider, key.trim());
      if (success) {
        await setPreferredProvider(selectedProvider);
        Alert.alert(
          '✅ Connexion réussie !',
          `${provider.name} est configuré. Ton TamadachAI peut maintenant te parler !`,
          [{ text: 'Continuer', onPress: onComplete }]
        );
      } else {
        Alert.alert('❌ Clé invalide', 'Vérifie ta clé API et réessaie.');
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de valider la clé. Vérifie ta connexion internet.');
    }
    setTesting(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🐣</Text>
          <Text style={styles.title}>Bienvenue sur TamadachAI !</Text>
          <Text style={styles.subtitle}>
            Pour que ton compagnon IA puisse te parler, il a besoin d'une clé API.
            C'est gratuit et ultra rapide avec Groq ! 🚀
          </Text>
        </View>

        {/* Provider selection */}
        <Text style={styles.sectionTitle}>Choisis ton provider IA :</Text>
        <View style={styles.providerGrid}>
          {PROVIDERS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.providerCard,
                selectedProvider === p.id && styles.providerCardSelected,
              ]}
              onPress={() => { setSelectedProvider(p.id); setShowSteps(false); setKey(''); }}
            >
              <Text style={styles.providerIcon}>{p.icon}</Text>
              <Text style={[
                styles.providerName,
                selectedProvider === p.id && styles.providerNameSelected,
              ]}>
                {p.name}
              </Text>
              {p.free && <Text style={styles.freeBadge}>GRATUIT</Text>}
              {!p.free && <Text style={styles.paidBadge}>PAYANT</Text>}
              <Text style={styles.providerModel}>{p.model}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Selected provider details */}
        <View style={styles.setupSection}>
          <View style={styles.setupHeader}>
            <Text style={styles.setupTitle}>
              {provider.icon} Configurer {provider.name}
            </Text>
            {provider.free && (
              <View style={styles.freeTag}>
                <Text style={styles.freeTagText}>✨ 100% Gratuit</Text>
              </View>
            )}
          </View>

          {/* Steps toggle */}
          <TouchableOpacity
            style={styles.stepsToggle}
            onPress={() => setShowSteps(!showSteps)}
          >
            <Text style={styles.stepsToggleText}>
              {showSteps ? '▼' : '▶'} Comment obtenir la clé ?
            </Text>
          </TouchableOpacity>

          {showSteps && (
            <View style={styles.stepsContainer}>
              {provider.steps.map((step, i) => (
                <Text key={i} style={styles.stepText}>{step}</Text>
              ))}
              <TouchableOpacity
                style={styles.openLinkBtn}
                onPress={() => Linking.openURL(provider.url)}
              >
                <Text style={styles.openLinkText}>🔗 Ouvrir {provider.name}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* API Key input */}
          <Text style={styles.inputLabel}>Clé API :</Text>
          <TextInput
            style={styles.input}
            value={key}
            onChangeText={setKey}
            placeholder={`Colle ta clé ${provider.name} ici...`}
            placeholderTextColor={THEME.colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          {/* Test button */}
          <TouchableOpacity
            style={[styles.testButton, !key.trim() && styles.testButtonDisabled]}
            onPress={handleTest}
            disabled={!key.trim() || testing}
          >
            {testing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.testButtonText}>
                ✅ Tester et continuer
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Skip info */}
        <Text style={styles.skipInfo}>
          Tu pourras ajouter d'autres providers plus tard dans les paramètres.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    fontSize: 60,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: THEME.colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.text,
    marginBottom: 12,
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  providerCard: {
    width: '48%',
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: THEME.colors.border,
    alignItems: 'center',
  },
  providerCardSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary + '15',
  },
  providerIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  providerName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.colors.text,
    textAlign: 'center',
  },
  providerNameSelected: {
    color: THEME.colors.primary,
  },
  freeBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#22C55E',
    backgroundColor: '#22C55E20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
  paidBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: THEME.colors.textSecondary,
    backgroundColor: THEME.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
  providerModel: {
    fontSize: 9,
    color: THEME.colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  setupSection: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  setupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  setupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.colors.text,
  },
  freeTag: {
    backgroundColor: '#22C55E20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  freeTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  stepsToggle: {
    paddingVertical: 8,
  },
  stepsToggleText: {
    fontSize: 14,
    color: THEME.colors.primary,
    fontWeight: '500',
  },
  stepsContainer: {
    backgroundColor: THEME.colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  stepText: {
    fontSize: 13,
    color: THEME.colors.text,
    lineHeight: 22,
  },
  openLinkBtn: {
    marginTop: 8,
    backgroundColor: THEME.colors.primary + '20',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  openLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.colors.primary,
  },
  inputLabel: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    backgroundColor: THEME.colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: THEME.colors.text,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 14,
  },
  testButton: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  testButtonDisabled: {
    opacity: 0.4,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
  skipInfo: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
