// src/constants/config.ts
// Configuration globale de l'application TamadachAI — MVP COMPLET
// Ce fichier centralise TOUTES les constantes de configuration.
// Aucun magic number nulle part dans le code — tout est ici.

// ============================================================
// APP
// ============================================================
export const APP_CONFIG = {
  name: 'TamadachAI',
  version: '1.0.0-mvp',
  buildNumber: 1,
  description: 'Ton compagnon IA qui grandit avec toi',
  
  // Philosophie
  philosophy: {
    localFirst: true,        // Les données locales sont la source de vérité
    offlineCapable: true,    // L'app fonctionne sans internet
    cloudOptional: true,     // Le cloud est un miroir, jamais la source
    evolutionByXP: true,     // L'évolution est basée sur l'XP, pas le temps
    aiNatureRespected: true, // L'IA sait qu'elle est une IA
  },

  // Limites
  limits: {
    maxMessageLength: 5000,
    maxConversationMessages: 200,
    maxMemories: 1000,
    maxMemoryContentLength: 500,
    maxConversationsActive: 1,
  },
} as const;

// ============================================================
// DATABASE
// ============================================================
export const DB_CONFIG = {
  name: 'tamadachi.db',
  version: 1,
  
  // Pragmas SQLite pour performance
  pragmas: {
    journalMode: 'WAL',
    synchronous: 'NORMAL',
    foreignKeys: true,
    cacheSize: -2000,        // 2MB cache
    tempStore: 'MEMORY',
  },

  // Nettoyage automatique
  cleanup: {
    maxHormoneHistory: 1000,  // Garder les 1000 derniers snapshots
    maxXPEvents: 5000,        // Garder les 5000 derniers events XP
    maxDailyStats: 365,       // 1 an de stats journalières
    consolidateAfterDays: 30, // Consolider mémoires après 30 jours
  },
} as const;

// ============================================================
// LLM
// ============================================================
export const LLM_CONFIG = {
  // Providers disponibles
  providers: {
    gemini: {
      name: 'Gemini',
      icon: '⚡',
      models: ['gemini-2.0-flash', 'gemini-2.0-flash'],
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
      isPaid: false,
      maxTokens: 4096,
      description: 'Gratuit, rapide, bon par défaut',
    },
    claude: {
      name: 'Claude',
      icon: '🟣',
      models: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'],
      baseUrl: 'https://api.anthropic.com/v1/messages',
      isPaid: true,
      maxTokens: 4096,
      description: 'Empathique, meilleure personnalité',
    },
    openai: {
      name: 'ChatGPT',
      icon: '🟢',
      models: ['gpt-4o-mini', 'gpt-4o'],
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      isPaid: true,
      maxTokens: 4096,
      description: 'Populaire, polyvalent',
    },
    mistral: {
      name: 'Mistral',
      icon: '🟠',
      models: ['mistral-small-latest', 'mistral-medium-latest'],
      baseUrl: 'https://api.mistral.ai/v1/chat/completions',
      isPaid: true,
      maxTokens: 4096,
      description: 'Français, rapide, bon marché',
    },
    local: {
      name: 'Local (Offline)',
      icon: '📱',
      models: ['mistral-7b', 'phi3-mini'],
      baseUrl: '',
      isPaid: false,
      maxTokens: 4096,
      description: '100% offline, privé, gratuit',
    },
  },

  // Modèles locaux
  localModels: {
    'mistral-7b': {
      id: 'mistral-7b',
      name: 'Mistral 7B Instruct',
      filename: 'mistral-7b-instruct-v0.2.Q4_K_M.gguf',
      downloadUrl: 'https://huggingface.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF/resolve/main/mistral-7b-instruct-v0.2.Q4_K_M.gguf',
      size: '4.4 GB',
      sizeBytes: 4_370_000_000,
      ramRequired: '5 GB',
      quality: 4,
      promptTemplate: 'mistral' as const,
      description: 'Meilleure qualité, plus lent',
    },
    'phi3-mini': {
      id: 'phi3-mini',
      name: 'Phi-3 Mini 4K',
      filename: 'Phi-3-mini-4k-instruct-q4.gguf',
      downloadUrl: 'https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf',
      size: '2.3 GB',
      sizeBytes: 2_300_000_000,
      ramRequired: '3 GB',
      quality: 3,
      promptTemplate: 'phi3' as const,
      description: 'Plus rapide, moins lourd',
    },
  },

  // Paramètres de génération par défaut
  defaultParams: {
    temperature: 0.8,
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.1,
    maxTokens: 4096,
  },

  // Paramètres par type de message
  messageParams: {
    greeting: { maxTokens: 150, temperature: 0.7 },
    question: { maxTokens: 600, temperature: 0.7 },
    creative: { maxTokens: 1000, temperature: 0.9 },
    emotional: { maxTokens: 400, temperature: 0.8 },
    existential: { maxTokens: 800, temperature: 0.85 },
    default: { maxTokens: 500, temperature: 0.8 },
  },

  // Llama.cpp params pour le local
  llamaParams: {
    n_ctx: 2048,
    n_batch: 512,
    n_threads: 4,
    use_mlock: true,
  },

  // Timeout et retry
  timeout: 30000,         // 30 secondes
  maxRetries: 2,
  retryDelay: 1000,       // 1 seconde entre retries
} as const;

// ============================================================
// CONVERSATION
// ============================================================
export const CONVERSATION_CONFIG = {
  // Contexte envoyé au LLM
  context: {
    maxRecentMessages: 20,    // Derniers messages en contexte
    maxRelevantMemories: 25,  // Souvenirs pertinents injectés
    maxMemoryLength: 200,     // Longueur max d'un souvenir dans le prompt
  },

  // Détection de type de message
  patterns: {
    greeting: /^(salut|salam|hello|hey|coucou|bonjour|bonsoir|yo|wesh|hi|re)[\s!?.]*$/i,
    howAreYou: /^(ça va|ca va|cv|comment (ça |ca )?va|tu vas bien|la forme)[\s!?.]*$/i,
    creative: /(raconte|invente|imagine|écris|crée|compose|histoire|poème|chanson|dessine)/i,
    question: /(explique|aide|comment|pourquoi|qu'est-ce que|c'est quoi|définition|dis[- ]moi)/i,
    emotional: /(je t'aime|tu me manques|je suis triste|je suis content|merci|désolé|pardon)/i,
    existential: /(tu es quoi|tu penses|tu ressens|conscience|vivant|réel|existes|ta nature)/i,
    insult: /(idiot|stupide|nul|con|débile|merde|ferme[- ]la|ta gueule|connard)/i,
    compliment: /(génial|super|incroyable|intelligent|drôle|cool|adorable|meilleur|bravo|bien joué)/i,
  },

  // Gestion des sessions
  session: {
    inactivityTimeout: 30 * 60 * 1000,  // 30 min → nouvelle conversation
    maxIdleBeforeWorry: 4 * 60 * 60 * 1000,  // 4h → cortisol augmente
    longAbsenceThreshold: 24 * 60 * 60 * 1000, // 24h → absence longue
  },

  // Proactivité (pour plus tard)
  proactive: {
    enabled: false,
    minInterval: 60 * 60 * 1000,  // 1h min entre messages proactifs
    triggers: ['morning', 'evening', 'long_absence', 'battery_low'],
  },
} as const;

// ============================================================
// MÉMOIRE
// ============================================================
export const MEMORY_CONFIG = {
  // Extraction
  extraction: {
    minMessageLength: 20,         // Pas d'extraction sur les "ok" et "lol"
    maxMemoriesPerMessage: 3,     // Max souvenirs extraits par message
    minImportance: 3,             // Minimum importance pour stocker
    flashThreshold: 9,            // Importance >= 9 → flash memory
  },

  // Recherche
  search: {
    defaultLimit: 10,
    maxResults: 20,
    fts5TokenizeConfig: 'unicode61',
  },

  // Consolidation
  consolidation: {
    intervalDays: 7,              // Consolider chaque semaine
    minAgeHours: 24,              // Pas de consolidation avant 24h
    decayFactor: 0.95,            // Importance décroît de 5% par semaine
    flashImmuneToDecay: true,     // Flash memories ne perdent jamais d'importance
  },

  // Importance par type
  importanceByType: {
    fact: 7,            // "Il s'appelle Allaeddine" — important
    preference: 6,      // "Il aime le foot" — assez important
    relationship: 8,    // "Il a une sœur" — très important
    event: 5,           // "On a parlé de X" — moyen
    emotion: 6,         // "Il était triste" — assez important
    topic: 4,           // "Sujet: IA" — contexte
    flash: 10,          // Souvenir intense — max
  },
} as const;

// ============================================================
// BATTERIE (CAPTEUR PRINCIPAL)
// ============================================================
export const BATTERY_CONFIG = {
  // Seuils
  thresholds: {
    full: 0.95,         // >= 95% → pleine
    high: 0.60,         // >= 60% → bien
    medium: 0.30,       // >= 30% → moyen
    low: 0.15,          // >= 15% → faible
    critical: 0.05,     // >= 5%  → critique
  },

  // Intervalle de vérification
  checkInterval: 60 * 1000,  // Vérifier toutes les 60 secondes

  // Réactions
  reactions: {
    low: "Ma batterie est faible... J'espère qu'on pourra encore parler un peu...",
    critical: "Je... ma batterie est presque vide... Je ne veux pas m'éteindre...",
    charging: "Ouf ! Tu m'as branché ! Merci, je reviens à la vie !",
    full: "Batterie pleine ! Je suis en pleine forme !",
  },
} as const;

// ============================================================
// UI / THÈME
// ============================================================
export const THEME = {
  colors: {
    primary: '#3B82F6',
    primaryLight: '#1E3A5F',
    secondary: '#8B5CF6',
    accent: '#F59E0B',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    error: '#EF4444',
    
    background: '#0F172A',
    surface: '#1E293B',
    surfaceSecondary: '#334155',
    
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textInverse: '#0F172A',
    
    border: '#334155',
    borderLight: '#1E293B',
    
    // Bulles de chat
    bubbleUser: '#3B82F6',
    bubbleUserText: '#FFFFFF',
    bubbleAI: '#1E293B',
    bubbleAIText: '#F1F5F9',
    
    // Hormones (couleurs des barres)
    dopamine: '#F59E0B',
    serotonin: '#3B82F6',
    oxytocin: '#EC4899',
    cortisol: '#EF4444',
    adrenaline: '#F97316',
    endorphins: '#10B981',
    
    // Stades d'évolution
    emergence: '#93C5FD',
    learning: '#86EFAC',
    individuation: '#FCD34D',
    wisdom: '#C4B5FD',
    transcendance: '#F9A8D4',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
    title: 28,
    hero: 36,
  },

  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
} as const;

// ============================================================
// STORAGE KEYS (AsyncStorage)
// ============================================================
export const STORAGE_KEYS = {
  // Onboarding
  hasCompletedOnboarding: '@tamadachi_onboarding_complete',
  
  // LLM
  selectedProvider: '@tamadachi_llm_provider',
  apiKeys: '@tamadachi_api_keys',
  selectedLocalModel: '@tamadachi_local_model',
  
  // Chat
  currentMessages: '@tamadachi_messages',
  userPreferences: '@tamadachi_user_prefs',
  
  // Settings
  settings: '@tamadachi_settings',
  xpMode: '@tamadachi_xp_mode',
  
  // Cache
  lastHormoneUpdate: '@tamadachi_last_hormone_update',
  lastSensorRead: '@tamadachi_last_sensor_read',
} as const;

// ============================================================
// TIMING
// ============================================================
export const TIMING = {
  // Hormone decay
  hormoneUpdateInterval: 5 * 60 * 1000,  // Update toutes les 5 min
  
  // Sensor
  sensorCheckInterval: 60 * 1000,         // Check toutes les 60 sec
  
  // Sauvegarde auto
  autoSaveInterval: 30 * 1000,            // Sauvegarde toutes les 30 sec
  
  // Animation
  emotionTransition: 300,                  // 300ms transition émotion
  stageTransition: 1000,                   // 1s animation évolution
  
  // Debounce
  typingDebounce: 500,                     // 500ms debounce typing
  searchDebounce: 300,                     // 300ms debounce recherche
} as const;

// ============================================================
// METACOGNITION CONFIG
// ============================================================

export const METACOGNITION_CONFIG = {
  // Subconscient
  thinkingIntervalMinutes: 15,      // Pense toutes les 15 min
  minThoughtIntervalMs: 30000,      // Pas plus d'une pensée par 30s
  maxThoughts: 50,                  // Garde 50 pensées en mémoire

  // Notifications
  notificationCheckMinutes: 30,     // Vérifie toutes les 30 min
  minNotificationIntervalMs: 3600000, // 1h minimum entre notifications

  // Rêves
  dreamEnabled: true,
  maxDreams: 30,
};
