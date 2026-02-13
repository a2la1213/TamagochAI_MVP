// src/stores/useTamadachiStore.ts
// Store Zustand principal du TamadachAI — MVP COMPLET v2
// Intègre la métacognition (subconscient, rêves, notifications)

import { Alert, AppState } from 'react-native';
import { create } from 'zustand';
import {
  Tamadachi,
  Message,
  EmotionState,
  HormoneLevels,
  LLMProviderName,
} from '../types';

// Database
import {
  initDatabase,
  getTamadachi,
  createTamadachi as dbCreateTamadachi,
  setSetting,
  getMessagesPaginated,
  updateMessageContent,
  deleteMessagesAfter,
} from '../services/database/DatabaseService';

// Core
import {
  generateGenome,
  analyzePersonality,
  getIdealTemperature,
  getIdealMaxTokens,
} from '../services/core/PersonalityService';
import {
  initHormones,
  getCurrentLevels,
  getMood,
} from '../services/core/HormoneService';
import {
  initEmotions,
  getCurrentEmotion,
  updateEmotion,
  getEmotionalSummary,
  vibrateForEmotion,
} from '../services/core/EmotionService';
import {
  initEvolution,
  getProgressSummary,
  setXPMode as serviceSetXPMode,
} from '../services/core/EvolutionService';
import {
  initConversation,
  processUserMessage,
  processAssistantResponse,
  getActiveMessages,
  getAllMessages,
  getFormattedChatHistory,
  endCurrentConversation,
  getSessionInfo,
  enrichPromptWithMetacognition,
  autoNameConversation,
} from '../services/core/ConversationService';

// Métacognition
import {
  startSubconscious,
  stopSubconscious,
  getRecentThoughts,
} from '../services/core/SubconsciousService';
import { consolidateMemories } from '../services/core/MemoryService';
import {
  initDreams,
  generateDream,
  getUnsharedDream,
} from '../services/core/DreamService';
import {
  initNotifications,
  stopNotifications,
} from '../services/core/NotificationService';

// LLM
import {
  initLLM,
  chat,
  setApiKey as llmSetApiKey,
  setPreferredProvider as llmSetPreferredProvider,
  getPreferredProvider,
  getAvailableProviders,
  getAllSupportedProviders,
  getLLMStats,
  setProviderModel,
} from '../services/llm/LLMOrchestrator';

// Sensors
import {
  initBattery,
  stopBattery,
  getBatteryState,
  getBatteryLevel,
  isCharging as isBatteryCharging,
} from '../services/sensors/BatteryService';
import { getApproxLocation } from '../services/sensors/LocationService';
import { initSensors, stopSensors } from '../services/sensors/SensorService';
import { setQuickReplyHandler } from '../services/core/NotificationService';

import { createLogger } from '../utils/helpers';

const log = createLogger('Store');

let batteryIntervalId: ReturnType<typeof setInterval> | null = null;
let isStoreInitialized = false;

// ============================================================
// TYPES
// ============================================================

export interface TamadachiState {
  tamadachi: Tamadachi | null;
  messages: Message[];
  conversationId: string | null;
  emotion: EmotionState | null;
  hormones: HormoneLevels | null;
  batteryLevel: number;
  batteryCharging: boolean;

  isInitialized: boolean;
  isInitializing: boolean;
  isGenerating: boolean;
  isBorn: boolean;
  streamingText: string;
  hasMoreMessages: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  createTamadachi: (name: string, avatarType?: string) => Promise<void>;
  shutdown: () => Promise<void>;
  editAndResend: (messageId: string, newContent: string) => Promise<void>;
  sendMessage: (content: string, attachments?: Array<{ type: 'image'; uri: string; base64: string; mimeType: string }>) => Promise<void>;
  refreshOnResume: () => Promise<void>;
  clearError: () => void;
  setApiKey: (provider: LLMProviderName, key: string) => Promise<boolean>;
  setPreferredProvider: (provider: LLMProviderName) => Promise<void>;
  setProviderModel: (provider: LLMProviderName, model: string) => Promise<void>;
  setXPMode: (mode: 'production' | 'prototype' | 'debug') => Promise<void>;
  refreshState: () => Promise<void>;
  loadMoreMessages: () => Promise<boolean>;
  refreshMessages: () => Promise<void>;
  getProgressData: () => Promise<any>;
  getEmotionalSummary: () => any;
  getLLMInfo: () => any;
  getBatteryInfo: () => any;
}

// ============================================================
// STORE
// ============================================================

export const useTamadachiStore = create<TamadachiState>((set, get) => ({
  tamadachi: null,
  messages: [],
  conversationId: null,
  emotion: null,
  hormones: null,
  batteryLevel: 1,
  batteryCharging: false,
  isInitialized: false,
  isInitializing: false,
  isGenerating: false,
  isBorn: false,
  streamingText: '',
  hasMoreMessages: true,
  error: null,

  // ============================================================
  // LIFECYCLE
  // ============================================================

  initialize: async () => {
    if (get().isInitializing || get().isInitialized) return;
    set({ isInitializing: true, error: null });

    try {
      log.info('🚀 Initializing TamadachAI...');

      await initDatabase();
      log.info('✅ Database ready');

      // Initialiser le LLM tôt (nécessaire pour configurer les clés API sur BirthScreen)
      // Demander toutes les permissions au démarrage
      try {
        const { requestForegroundPermissionsAsync } = await import('expo-location');
        await requestForegroundPermissionsAsync().catch(() => {});
      } catch (e) { /* optional */ }
      try {
        const Notifications = await import('expo-notifications');
        await Notifications.requestPermissionsAsync().catch(() => {});
      } catch (e) { /* optional */ }

      try { await initLLM(); } catch (e) { console.warn('LLM early init:', e); }
      log.info('✅ LLM ready');

      const tama = await getTamadachi();

      if (!tama) {
        set({ isInitialized: true, isInitializing: false, isBorn: false });
        log.info('No TamadachAI found — awaiting birth');
        return;
      }

      await initAllServices(tama);
      const convId = getSessionInfo().conversationId;
      const messages = convId ? await getMessagesPaginated(convId, 10) : [];

      set({
        tamadachi: tama,
        messages,
        conversationId: getSessionInfo().conversationId,
        emotion: getCurrentEmotion(),
        hormones: getCurrentLevels(),
        batteryLevel: getBatteryLevel(),
        batteryCharging: isBatteryCharging(),
        isInitialized: true,
      });

      // Récupérer la localisation et démarrer les capteurs
      getApproxLocation().catch(() => {});
      initSensors().catch(() => {});

      // Connecter les réponses rapides aux notifications
      if (!isStoreInitialized) {
        setQuickReplyHandler((text: string) => {
          get().sendMessage(text);
        });

        // Rafraîchir la batterie toutes les 60s
        if (batteryIntervalId) clearInterval(batteryIntervalId);
        batteryIntervalId = setInterval(() => {
          set({
            batteryLevel: getBatteryLevel(),
            batteryCharging: isBatteryCharging(),
          });
        }, 60000);
        isStoreInitialized = true;
      }

      set({
        isInitializing: false,
        isBorn: true,
      });

      log.info(`✅ TamadachAI ready: ${tama.name} (${tama.stage}, ${tama.totalXP} XP)`);
    } catch (error: any) {
      log.error('❌ Initialization failed:', error);
      set({ isInitializing: false, error: `Erreur d'initialisation: ${error.message}` });
    }
  },

  createTamadachi: async (name: string, avatarType?: string) => {
    try {
      set({ isInitializing: true, error: null });
      log.info(`🥚 Creating TamadachAI: ${name}`);

      const genome = generateGenome();
      const personality = analyzePersonality(genome);
      log.info(`Archetype: ${personality.archetype}`);

      await dbCreateTamadachi(name, genome, (avatarType || 'animal') as any, 'neutral', '#3B82F6');

      const tama = await getTamadachi();
      if (!tama) throw new Error('Failed to retrieve created TamadachAI');

      await initAllServices(tama);
      const convId2 = getSessionInfo().conversationId;
      const messages = convId2 ? await getMessagesPaginated(convId2, 10) : [];

      set({
        tamadachi: tama,
        messages,
        conversationId: getSessionInfo().conversationId,
        emotion: getCurrentEmotion(),
        hormones: getCurrentLevels(),
        isInitialized: true,
        isInitializing: false,
        isBorn: true,
      });

      log.info(`✅ ${name} is born! 🎉`);
    } catch (error: any) {
      log.error('❌ Birth failed:', error);
      set({ isInitializing: false, error: `Erreur de création: ${error.message}` });
    }
  },

  shutdown: async () => {
    try {
      stopBattery();
      await stopSubconscious();
      stopNotifications();
      await endCurrentConversation('app_closed');
      log.info('App shutdown complete');
    } catch (error) {
      log.error('Shutdown error:', error);
    }
  },

  // ============================================================
  // CHAT — LE CŒUR
  // ============================================================

  refreshOnResume: async () => {
    try {
      const tama = await getTamadachi();
      if (!tama) return;

      // Refresh batterie
      const { getBatteryLevel, isCharging: getChargingStatus } = await import('../services/sensors/BatteryService');
      set({ batteryLevel: getBatteryLevel(), batteryCharging: getChargingStatus() });

      // Refresh messages — charger les 10 derniers
      const convId2 = getSessionInfo().conversationId;
      const messages = convId2 ? await getMessagesPaginated(convId2, 10) : [];
      set({ messages, hasMoreMessages: messages.length >= 10 });

      // Refresh localisation
      const { getApproxLocation } = await import('../services/sensors/LocationService');
      getApproxLocation().catch(() => {});
    } catch (e) {
      console.warn('Refresh on resume failed:', e);
    }
  },

  editAndResend: async (messageId: string, newContent: string) => {
    const { tamadachi, isGenerating, conversationId } = get();
    if (!tamadachi || isGenerating) return;

    set({ isGenerating: true, streamingText: '', error: null });

    const generatingTimeout = setTimeout(() => {
      if (get().isGenerating) {
        set({ isGenerating: false, streamingText: '' });
      }
    }, 90000);

    try {
      // 1. Modifier le message original en DB
      await updateMessageContent(messageId, newContent);
      
      // 2. Supprimer la réponse LLM qui suivait
      const convId = conversationId || getSessionInfo().conversationId;
      if (convId) {
        await deleteMessagesAfter(messageId, convId);
      }

      // 3. Recharger les messages (avec le message modifié)
      const messages = convId ? await getMessagesPaginated(convId, 10) : [];
      set({ messages });

      // 4. Regénérer la réponse LLM
      log.info('📤 STEP 3: Calling processUserMessage...');
      const result = await processUserMessage(tamadachi.id, newContent, getBatteryLevel(), isBatteryCharging());
      const enrichedPrompt = enrichPromptWithMetacognition(result.systemPrompt);
      const chatHistory = await getFormattedChatHistory(20);
      const temperature = getIdealTemperature(tamadachi.genome, tamadachi.stage);
      const maxTokens = getIdealMaxTokens(tamadachi.genome, tamadachi.stage);

      set({ streamingText: '⏳ Réflexion...' });

      const editChatPromise = chat(enrichedPrompt, chatHistory.slice(0, -1), newContent, { temperature, maxTokens });
      const editTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Edit timeout 65s')), 65000)
      );
      const response = await Promise.race([editChatPromise, editTimeoutPromise]);

      let fullResponse = '';
      if (response.success) {
        fullResponse = response.content;
      }

      if (fullResponse && convId) {
        await processAssistantResponse(tamadachi.id, convId, fullResponse, { provider: getPreferredProvider() });
        const updated = await getMessagesPaginated(convId, 10);
        clearTimeout(generatingTimeout);
        set({ messages: updated, isGenerating: false, streamingText: '' });
      } else {
        clearTimeout(generatingTimeout);
        set({ isGenerating: false, streamingText: '' });
        Alert.alert('Erreur', 'Impossible de regénérer la réponse.');
      }
    } catch (error: any) {
      clearTimeout(generatingTimeout);
      log.error('Edit failed:', error);
      set({ isGenerating: false, streamingText: '', error: error.message });
    }
  },

  sendMessage: async (content: string, attachments?: Array<{ type: 'image'; uri: string; base64: string; mimeType: string }>) => {
    const { tamadachi, isGenerating } = get();
    if (!tamadachi || isGenerating) {
      log.warn('sendMessage blocked: tamadachi=' + !!tamadachi + ' isGenerating=' + isGenerating);
      return;
    }

    set({ isGenerating: true, streamingText: '', error: null });

    // Safety: forcer isGenerating à false après 90s
    const generatingTimeout = setTimeout(() => {
      if (get().isGenerating) {
        const providers = getAvailableProviders();
        const preferred = getPreferredProvider();
        const errorReport = [
          '⏱️ Timeout après 90s',
          '',
          'Provider: ' + preferred,
          'Disponibles: ' + (providers.length > 0 ? providers.join(', ') : 'AUCUN ❌'),
          '',
          'Solutions:',
          '• Vérifie ta connexion internet',
          '• Vérifie ta clé API dans Paramètres',
          '• Essaie un autre provider',
        ].join('\n');
        
        log.error('⚠️ TIMEOUT REPORT: preferred=' + preferred + ' available=' + providers.join(','));
        set({ isGenerating: false, streamingText: '' });
        Alert.alert('🕐 Pas de réponse', errorReport);
      }
    }, 90000);

    try {
      // Afficher le message user IMMÉDIATEMENT (avant tout traitement)
      const tempUserMsg = {
        id: 'temp_' + Date.now(),
        conversationId: get().conversationId || '',
        role: 'user' as const,
        content,
        createdAt: new Date().toISOString(),
        attachments: attachments?.map(a => ({ type: a.type, uri: a.uri, mimeType: a.mimeType })) || [],
        isEdited: false,
        isRegenerated: false,
      };
      set({ messages: [...get().messages, tempUserMsg] });

      // Rafraîchir la batterie maintenant
      const batteryLevel = getBatteryLevel();
      const charging = isBatteryCharging();
      set({ batteryLevel, batteryCharging: charging });

      // 1. Pipeline complet (hormones, XP, mémoire, etc.)
      log.info('📤 STEP 3: Calling processUserMessage...');
      const result = await processUserMessage(
        tamadachi.id,
        content,
        batteryLevel,
        charging,
      );

      // 1b. Sauver les attachments dans le message user
      if (attachments && attachments.length > 0) {
        const { updateMessageAttachments } = await import('../services/database/DatabaseService');
        const attData = attachments.map(a => ({
          type: a.type || 'image',
          uri: a.uri,
          mimeType: a.mimeType,
          fileName: (a as any).fileName,
        }));
        await updateMessageAttachments(result.messageId, attData);
      }

      log.info('📤 STEP 4: processUserMessage done, convId=' + result.conversationId);

      // 2. Refresh messages (inclut le message user)
      // Messages déjà à jour grâce au temp message ajouté avant

      // 3. Enrichir le prompt avec métacognition (pensées + rêves)
      const enrichedPrompt = enrichPromptWithMetacognition(result.systemPrompt);

      // 4. Historique chat
      const chatHistory = await getFormattedChatHistory(20);

      // 5. Paramètres LLM personnalisés
      const temperature = getIdealTemperature(tamadachi.genome, tamadachi.stage);
      const maxTokens = getIdealMaxTokens(tamadachi.genome, tamadachi.stage);

      // 6. Appel LLM (direct, pas de streaming — React Native ne supporte pas ReadableStream)
      let fullResponse = '';
      set({ streamingText: '⏳ Réflexion...' });

      // Safety timeout pour éviter le blocage infini
      // Préparer les attachments pour le LLM
      const llmAttachments = attachments?.map(a => ({
        type: 'image' as const,
        imageBase64: a.base64,
        mimeType: a.mimeType,
      }));

      set({ streamingText: '🧠 ' + getPreferredProvider() + '...' });
      const chatPromise = chat(
        enrichedPrompt,
        chatHistory.slice(0, -1),
        content,
        { temperature, maxTokens, attachments: llmAttachments },
      );
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout 65s | Provider: ' + getPreferredProvider() + ' | Available: ' + getAvailableProviders().join(','))), 65000)
      );
      const response = await Promise.race([chatPromise, timeoutPromise]);

      if (response.success) {
        fullResponse = response.content;
        log.info(`LLM response from ${response.provider}/${response.model} — ${response.tokensUsed} tokens, ${response.latencyMs}ms`);
      } else {
        log.error(`LLM failed: ${response.error}`);
        // Retry auto pour quota
        if (response.error?.includes('429') || response.error?.includes('quota') || response.error?.includes('Resource has been exhausted')) {
          log.warn('Quota/rate limit hit, retrying in 30s...');
          set({ streamingText: '⏳ Rate limit... retry dans 15s' });
          await new Promise(r => setTimeout(r, 15000));
          const retryResponse = await chat(
            enrichedPrompt,
            chatHistory.slice(0, -1),
            content,
            { temperature, maxTokens, attachments: llmAttachments },
          );
          if (retryResponse.success && retryResponse.content) {
            fullResponse = retryResponse.content;
            log.info('Retry succeeded!');
          } else {
            // Ne PAS sauver le fallback — juste notifier l'utilisateur
            fullResponse = '';
            Alert.alert('Erreur LLM', 'Impossible de générer une réponse. Réessaie dans quelques secondes.');
          }
        } else {
          // Erreur non-quota — ne pas sauver le fallback  
          fullResponse = '';
          log.error('LLM error (non-quota): ' + response.error);
          log.error('Available providers: ' + getAvailableProviders().join(', '));
          log.error('Preferred: ' + getPreferredProvider());
          Alert.alert('Erreur LLM', [
            response.error || 'Erreur de connexion',
            '',
            'Provider: ' + getPreferredProvider(),
            'Disponibles: ' + getAvailableProviders().join(', '),
            'Providers map: ' + (getAvailableProviders().length || '0'),
            '',
            'Vérifie ta clé API dans Paramètres',
          ].join('\n'));
        }
      }
      set({ streamingText: fullResponse || '' });

      // 8. Stocker la réponse
      if (fullResponse) {
        await processAssistantResponse(
          tamadachi.id,
          result.conversationId,
          fullResponse,
          { provider: getPreferredProvider() },
        );
      }

      // 9. Refresh complet
      let updatedTama;
      try {
        updatedTama = await getTamadachi();
      } catch (e: any) {
        log.error('Refresh crashed:', e);
        updatedTama = tamadachi;
      }
      const convIdFinal = get().conversationId || getSessionInfo().conversationId;
      const finalMessages = convIdFinal ? await getMessagesPaginated(convIdFinal, 10) : [];
      const newEmotion = updateEmotion();
      
      // Vibration émotionnelle
      if (newEmotion?.primary) {
        vibrateForEmotion(newEmotion.primary);
      }

      clearTimeout(generatingTimeout);
      set({
        tamadachi: updatedTama,
        messages: finalMessages,
        emotion: newEmotion,
        hormones: getCurrentLevels(),
        isGenerating: false,
        streamingText: '',
        batteryLevel: getBatteryLevel(),
        batteryCharging: isBatteryCharging(),
      });

      log.info(`Message OK — XP: +${result.xpAwarded}, Memories: +${result.memoriesCreated}`);

      if (result.evolved) {
        log.info(`🌟 EVOLUTION! ${result.evolutionMessage}`);
      }
    } catch (error: any) {
      log.error('❌ Send message failed:', error);
      clearTimeout(generatingTimeout);
      const errReport = [
        '❌ ' + error.message,
        '',
        'Provider: ' + getPreferredProvider(),
        'Disponibles: ' + getAvailableProviders().join(', '),
      ].join('\n');
      set({ isGenerating: false, streamingText: '', error: error.message });
      Alert.alert('Erreur', errReport);
    }
  },

  clearError: () => set({ error: null }),

  // ============================================================
  // CONFIG
  // ============================================================

  setApiKey: async (provider, key) => {
    const success = await llmSetApiKey(provider, key);
    return success;
  },

  setPreferredProvider: async (provider) => {
    await llmSetPreferredProvider(provider);
  },

  setProviderModel: async (provider, model) => {
    await setProviderModel(provider, model);
  },

  setXPMode: async (mode) => {
    await serviceSetXPMode(mode);
  },

  // ============================================================
  // REFRESH & GETTERS
  // ============================================================

  refreshState: async () => {
    const tama = await getTamadachi();
    if (tama) {
      set({
        tamadachi: tama,
        emotion: getCurrentEmotion(),
        hormones: getCurrentLevels(),
        batteryLevel: getBatteryLevel(),
        batteryCharging: isBatteryCharging(),
      });
    }
  },

  loadMoreMessages: async () => {
    const { messages, tamadachi } = get();
    if (!tamadachi || messages.length === 0) return false;

    const oldestMsg = messages[0];
    const conversationId = messages[0]?.conversationId;
    if (!conversationId) return false;

    const olderMessages = await getMessagesPaginated(conversationId, 10, oldestMsg.createdAt);
    if (olderMessages.length === 0) {
      set({ hasMoreMessages: false });
      return false;
    }

    set({ messages: [...olderMessages, ...messages], hasMoreMessages: olderMessages.length >= 10 });
    return true;
  },

  refreshMessages: async () => {
    const tama = get().tamadachi;
    const convId3 = tama ? getSessionInfo().conversationId : null;
    const messages = convId3 ? await getMessagesPaginated(convId3, 10) : [];
    set({ messages });
  },

  getProgressData: async () => {
    const { tamadachi } = get();
    if (!tamadachi) return null;
    return getProgressSummary(tamadachi.id);
  },

  getEmotionalSummary: () => getEmotionalSummary(),

  getLLMInfo: () => ({
    preferred: getPreferredProvider(),
    available: getAvailableProviders(),
    all: getAllSupportedProviders(),
    stats: getLLMStats(),
  }),

  getBatteryInfo: () => getBatteryState(),
}));

// ============================================================
// INIT ALL SERVICES (incluant métacognition)
// ============================================================

async function initAllServices(tama: Tamadachi): Promise<void> {
  // Core
  await initHormones(tama.id);
  log.info('✅ Hormones');

  initEmotions();
  log.info('✅ Emotions');

  await initEvolution();
  log.info('✅ Evolution');

  await initLLM();
  log.info('✅ LLM');

  await initConversation(tama.id);
  log.info('✅ Conversation');

  await initBattery(tama.id);
  log.info('✅ Battery');

  // Métacognition
  await initDreams();
  log.info('✅ Dreams');

  // Délayer les services gourmands en LLM (évite 429 au démarrage)
  log.info('⏳ Background services (dream, subconscious, notifications) delayed 3min...');
  setTimeout(async () => {
    try { await generateDream(tama.id); log.info('🌙 Dream generated'); } catch (e) { log.warn('Dream failed:', e); }
    try { await startSubconscious(tama.id); log.info('🧠 Subconscious started'); } catch (e) { log.warn('Subconscious failed:', e); }
    try { await initNotifications(); log.info('🔔 Notifications started'); } catch (e) { log.warn('Notifications failed:', e); }
  }, 3 * 60 * 1000);
  log.info('✅ Init complete (background in 3min)');
}
