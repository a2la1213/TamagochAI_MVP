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
      setQuickReplyHandler((text: string) => {
        get().sendMessage(text);
      });

      // Rafraîchir la batterie toutes les 30s
      setInterval(() => {
        set({
          batteryLevel: getBatteryLevel(),
          batteryCharging: isBatteryCharging(),
        });
      }, 30000);

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

  sendMessage: async (content: string, attachments?: Array<{ type: 'image'; uri: string; base64: string; mimeType: string }>) => {
    const { tamadachi, isGenerating } = get();
    if (!tamadachi || isGenerating) return;

    set({ isGenerating: true, streamingText: '', error: null });

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
      set({ streamingText: '...' });

      // Safety timeout pour éviter le blocage infini
      // Préparer les attachments pour le LLM
      const llmAttachments = attachments?.map(a => ({
        type: 'image' as const,
        imageBase64: a.base64,
        mimeType: a.mimeType,
      }));

      const chatPromise = chat(
        enrichedPrompt,
        chatHistory.slice(0, -1),
        content,
        { temperature, maxTokens, attachments: llmAttachments },
      );
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: pas de réponse après 60s')), 65000)
      );
      const response = await Promise.race([chatPromise, timeoutPromise]);

      if (response.success) {
        fullResponse = response.content;
        log.info(`LLM response from ${response.provider}/${response.model} — ${response.tokensUsed} tokens, ${response.latencyMs}ms`);
      } else {
        fullResponse = response.content; // fallback message
        log.error(`LLM failed: ${response.error}`);
        // Erreur user-friendly pour quota — retry auto après 3s
        if (response.error?.includes('429') || response.error?.includes('quota')) {
          log.warn('Quota hit, retrying in 3s...');
          await new Promise(r => setTimeout(r, 3000));
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
            Alert.alert('Quota dépassé', 'Attends quelques secondes et réessaie.');
          }
        }
      }
      set({ streamingText: fullResponse });

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
      const updatedTama = await getTamadachi();
      const convIdFinal = get().conversationId || getSessionInfo().conversationId;
      const finalMessages = convIdFinal ? await getMessagesPaginated(convIdFinal, 10) : [];
      const newEmotion = updateEmotion();
      
      // Vibration émotionnelle
      if (newEmotion?.primary) {
        vibrateForEmotion(newEmotion.primary);
      }

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
      set({ isGenerating: false, streamingText: '', error: `Erreur: ${error.message}` });
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

  await generateDream(tama.id);

  await startSubconscious(tama.id);
  log.info('✅ Subconscious');

  await initNotifications();
  log.info('✅ Notifications');
}
