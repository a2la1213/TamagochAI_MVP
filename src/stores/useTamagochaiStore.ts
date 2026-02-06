// src/stores/useTamagochaiStore.ts
// Store Zustand principal du TamagochAI — MVP COMPLET v2
// Intègre la métacognition (subconscient, rêves, notifications)

import { create } from 'zustand';
import {
  Tamagochai,
  Message,
  EmotionState,
  HormoneLevels,
  LLMProviderName,
} from '../types';

// Database
import {
  initDatabase,
  getTamagochai,
  createTamagochai as dbCreateTamagochai,
  setSetting,
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
  getFormattedChatHistory,
  endCurrentConversation,
  getSessionInfo,
  enrichPromptWithMetacognition,
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
  chatStream,
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

import { createLogger } from '../utils/helpers';

const log = createLogger('Store');

// ============================================================
// TYPES
// ============================================================

export interface TamagochaiState {
  tamagochai: Tamagochai | null;
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
  error: string | null;

  initialize: () => Promise<void>;
  createTamagochai: (name: string) => Promise<void>;
  shutdown: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
  setApiKey: (provider: LLMProviderName, key: string) => Promise<boolean>;
  setPreferredProvider: (provider: LLMProviderName) => Promise<void>;
  setProviderModel: (provider: LLMProviderName, model: string) => Promise<void>;
  setXPMode: (mode: 'production' | 'prototype' | 'debug') => Promise<void>;
  refreshState: () => Promise<void>;
  refreshMessages: () => Promise<void>;
  getProgressData: () => Promise<any>;
  getEmotionalSummary: () => any;
  getLLMInfo: () => any;
  getBatteryInfo: () => any;
}

// ============================================================
// STORE
// ============================================================

export const useTamagochaiStore = create<TamagochaiState>((set, get) => ({
  tamagochai: null,
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
  error: null,

  // ============================================================
  // LIFECYCLE
  // ============================================================

  initialize: async () => {
    if (get().isInitializing || get().isInitialized) return;
    set({ isInitializing: true, error: null });

    try {
      log.info('🚀 Initializing TamagochAI...');

      await initDatabase();
      log.info('✅ Database ready');

      const tama = await getTamagochai();

      if (!tama) {
        set({ isInitialized: true, isInitializing: false, isBorn: false });
        log.info('No TamagochAI found — awaiting birth');
        return;
      }

      await initAllServices(tama);
      const messages = await getActiveMessages();

      set({
        tamagochai: tama,
        messages,
        conversationId: getSessionInfo().conversationId,
        emotion: getCurrentEmotion(),
        hormones: getCurrentLevels(),
        batteryLevel: getBatteryLevel(),
        batteryCharging: isBatteryCharging(),
        isInitialized: true,
        isInitializing: false,
        isBorn: true,
      });

      log.info(`✅ TamagochAI ready: ${tama.name} (${tama.stage}, ${tama.totalXP} XP)`);
    } catch (error: any) {
      log.error('❌ Initialization failed:', error);
      set({ isInitializing: false, error: `Erreur d'initialisation: ${error.message}` });
    }
  },

  createTamagochai: async (name: string) => {
    try {
      set({ isInitializing: true, error: null });
      log.info(`🥚 Creating TamagochAI: ${name}`);

      const genome = generateGenome();
      const personality = analyzePersonality(genome);
      log.info(`Archetype: ${personality.archetype}`);

      await dbCreateTamagochai(name, genome, 'robot', 'neutral', '#3B82F6');

      const tama = await getTamagochai();
      if (!tama) throw new Error('Failed to retrieve created TamagochAI');

      await initAllServices(tama);
      const messages = await getActiveMessages();

      set({
        tamagochai: tama,
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

  sendMessage: async (content: string) => {
    const { tamagochai, isGenerating } = get();
    if (!tamagochai || isGenerating) return;

    set({ isGenerating: true, streamingText: '', error: null });

    try {
      const batteryLevel = getBatteryLevel();
      const charging = isBatteryCharging();

      // 1. Pipeline complet (hormones, XP, mémoire, etc.)
      const result = await processUserMessage(
        tamagochai.id,
        content,
        batteryLevel,
        charging,
      );

      // 2. Refresh messages (inclut le message user)
      const messagesAfterUser = await getActiveMessages();
      set({ messages: messagesAfterUser });

      // 3. Enrichir le prompt avec métacognition (pensées + rêves)
      const enrichedPrompt = enrichPromptWithMetacognition(result.systemPrompt);

      // 4. Historique chat
      const chatHistory = await getFormattedChatHistory(20);

      // 5. Paramètres LLM personnalisés
      const temperature = getIdealTemperature(tamagochai.genome, tamagochai.stage);
      const maxTokens = getIdealMaxTokens(tamagochai.genome, tamagochai.stage);

      // 6. Appel LLM avec streaming
      let fullResponse = '';
      const stream = chatStream(
        enrichedPrompt,
        chatHistory.slice(0, -1),
        content,
        { temperature, maxTokens },
      );

      for await (const chunk of stream) {
        if (typeof chunk === 'string') {
          fullResponse += chunk;
          set({ streamingText: fullResponse });
        }
      }

      // 7. Fallback si pas de streaming
      if (!fullResponse) {
        const response = await chat(
          enrichedPrompt,
          chatHistory.slice(0, -1),
          content,
          { temperature, maxTokens },
        );
        fullResponse = response.content;
        set({ streamingText: fullResponse });
      }

      // 8. Stocker la réponse
      if (fullResponse) {
        await processAssistantResponse(
          tamagochai.id,
          result.conversationId,
          fullResponse,
          { provider: getPreferredProvider() },
        );
      }

      // 9. Refresh complet
      const updatedTama = await getTamagochai();
      const finalMessages = await getActiveMessages();
      const newEmotion = updateEmotion();

      set({
        tamagochai: updatedTama,
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
    const tama = await getTamagochai();
    if (tama) {
      set({
        tamagochai: tama,
        emotion: getCurrentEmotion(),
        hormones: getCurrentLevels(),
        batteryLevel: getBatteryLevel(),
        batteryCharging: isBatteryCharging(),
      });
    }
  },

  refreshMessages: async () => {
    const messages = await getActiveMessages();
    set({ messages });
  },

  getProgressData: async () => {
    const { tamagochai } = get();
    if (!tamagochai) return null;
    return getProgressSummary(tamagochai.id);
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

async function initAllServices(tama: Tamagochai): Promise<void> {
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
