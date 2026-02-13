// src/services/llm/LLMOrchestrator.ts
// Orchestrateur LLM du TamadachAI — MVP v3 CLEAN
//
// Supporte 5 providers via LLMProviderInstance interface.
// Gère fallback, retry, streaming, stats.

import {
  LLMProviderName,
  LLMProviderInstance,
  LLMRequest,
  LLMResponse,
  LLMMessage,
  LLMStats,
} from '../../types';
import { LLM_CONFIG } from '../../constants/config';
import { GeminiProvider } from './providers/GeminiProvider';
import { ClaudeProvider } from './providers/ClaudeProvider';
import {
  createOpenAIProvider,
  createDeepSeekProvider,
  createPerplexityProvider,
} from './providers/OpenAICompatibleProvider';
import { getSetting, setSetting } from '../database/DatabaseService';
import { createLogger } from '../../utils/helpers';

const log = createLogger('LLM');

// ============================================================
// MODELS PAR PROVIDER (défauts qui peuvent être overridés)
// ============================================================

const PROVIDER_MODELS: Record<LLMProviderName, string> = {
  gemini: 'gemini-2.0-flash',
  claude: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat',
  perplexity: 'sonar-pro',
};

// ============================================================
// ÉTAT
// ============================================================

const providers: Map<LLMProviderName, LLMProviderInstance> = new Map();
let preferredProvider: LLMProviderName = 'gemini';
let fallbackOrder: LLMProviderName[] = ['gemini', 'deepseek', 'openai', 'claude', 'perplexity'];
let isInitialized = false;

// Rate limiter — minimum 2s entre chaque appel
let lastLLMCallTime = 0;
const MIN_CALL_INTERVAL_MS = 2000;

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastLLMCallTime;
  if (elapsed < MIN_CALL_INTERVAL_MS) {
    const wait = MIN_CALL_INTERVAL_MS - elapsed;
    await new Promise(r => setTimeout(r, wait));
  }
  lastLLMCallTime = Date.now();
}

const stats: LLMStats = {
  totalRequests: 0,
  totalErrors: 0,
  totalTokens: 0,
  averageLatencyMs: 0,
  successRate: 100,
  lastProvider: null,
  providerUsage: {},
};

let totalLatencyMs = 0;

// ============================================================
// INITIALISATION
// ============================================================

export async function initLLM(): Promise<void> {
  if (isInitialized) return;

  // Charger le provider préféré depuis la DB
  const savedProvider = await getSetting('preferred_provider');
  if (savedProvider && isValidProvider(savedProvider)) {
    preferredProvider = savedProvider as LLMProviderName;
  }

  // Charger les modèles custom
  for (const name of Object.keys(PROVIDER_MODELS) as LLMProviderName[]) {
    const savedModel = await getSetting(`model_${name}`);
    if (savedModel) {
      PROVIDER_MODELS[name] = savedModel;
    }
  }

  // Instancier les providers
  providers.set('gemini', new GeminiProvider());
  providers.set('claude', new ClaudeProvider());
  providers.set('openai', createOpenAIProvider());
  providers.set('deepseek', createDeepSeekProvider());
  providers.set('perplexity', createPerplexityProvider());

  log.info('🔑 Loading saved API keys...');
  // Charger les clés API sauvegardées
  for (const [name, provider] of providers) {
    const savedKey = await getSetting(`api_key_${name}`);
    log.info(`🔑 ${name}: key=${savedKey ? savedKey.substring(0, 8) + '...' : 'NONE'}`);
    if (savedKey) {
      provider.setApiKey(savedKey);
      log.info(`✅ ${name} key loaded`);
    }
  }

  // Recalculer l'ordre de fallback
  updateFallbackOrder();

  isInitialized = true;
  const avail = getAvailableProviders();
  log.info(`✅ LLM initialized — Preferred: ${preferredProvider}, Available: [${avail.join(', ')}] (${avail.length} providers)`);
}

// ============================================================
// API PRINCIPALE
// ============================================================

/**
 * Envoie un message au LLM et retourne la réponse
 */
export async function chat(
  systemPrompt: string,
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string; attachments?: any[] }>,
  userMessage: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    provider?: LLMProviderName;
    skipFallback?: boolean;
    attachments?: any[];
  },
): Promise<LLMResponse> {
  ensureInitialized();

  // Limiter l'historique pour éviter le token overflow
  const recentHistory = chatHistory.slice(-10);
  const messages: LLMMessage[] = recentHistory.map(m => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
    attachments: m.attachments,
  }));

  // Ajouter les attachments au dernier message user
  const userAttachments = options?.attachments || [];

  const request: LLMRequest = {
    systemPrompt,
    messages,
    userMessage,
    temperature: options?.temperature ?? LLM_CONFIG.defaultParams.temperature,
    maxTokens: options?.maxTokens ?? LLM_CONFIG.defaultParams.maxTokens,
    topP: LLM_CONFIG.defaultParams.topP,
    userAttachments,
  };

  log.info(`🔄 chat() called — providers map size: ${providers.size}, preferred: ${preferredProvider}`);
  const providerOrder = buildProviderOrder(options?.provider, options?.skipFallback);
  log.info(`🔄 Provider order: [${providerOrder.join(', ')}]`);
  const errors: string[] = [];

  for (const providerName of providerOrder) {
    const provider = providers.get(providerName);
    if (!provider || !provider.getApiKey()) {
      errors.push(`${providerName}: no API key`);
      continue;
    }

    try {
      log.info(`Trying provider: ${providerName} (key: ${provider.getApiKey()?.substring(0, 8)}...)`);
      const response = await attemptWithRetry(provider, request);

      if (response.success) {
        recordSuccess(providerName, response);
        return response;
      }

      errors.push(`${providerName}: ${response.error || 'unknown error'}`);
      log.warn(`Provider ${providerName} returned error: ${response.error}`);
    } catch (error: any) {
      const errMsg = error instanceof Error ? error.message : String(error);
      errors.push(`${providerName}: ${errMsg}`);
      log.error(`Provider ${providerName} threw: ${errMsg}`);
    }
  }

  // Tous les providers ont échoué
  stats.totalRequests++;
  stats.totalErrors++;
  updateSuccessRate();

  return {
    success: false,
    content: generateFallbackMessage(),
    provider: preferredProvider,
    model: 'fallback',
    tokensUsed: 0,
    latencyMs: 0,
    error: `All providers failed: ${errors.join('; ')}`,
    finishReason: 'error',
  };
}

// ============================================================
// RETRY LOGIC
// ============================================================

async function attemptWithRetry(
  provider: LLMProviderInstance,
  request: LLMRequest,
  maxRetries: number = LLM_CONFIG.maxRetries,
): Promise<LLMResponse> {
  let lastError: string = '';

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await waitForRateLimit();
      const startTime = Date.now();
      const response = await provider.generate(request);
      response.latencyMs = Date.now() - startTime;
      return response;
    } catch (error: any) {
      lastError = error.message;
      if (attempt < maxRetries) {
        const delay = LLM_CONFIG.retryDelay * Math.pow(2, attempt);
        log.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${lastError}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  return {
    success: false,
    content: '',
    provider: provider.name,
    model: '',
    tokensUsed: 0,
    latencyMs: 0,
    error: lastError,
    finishReason: 'error',
  };
}

// ============================================================
// CONFIG API
// ============================================================

export async function setApiKey(provider: LLMProviderName, key: string): Promise<boolean> {
  // S'assurer que les providers sont instanciés
  if (providers.size === 0) {
    providers.set('gemini', new GeminiProvider());
    providers.set('claude', new ClaudeProvider());
    providers.set('openai', createOpenAIProvider());
    providers.set('deepseek', createDeepSeekProvider());
    providers.set('perplexity', createPerplexityProvider());
    log.info('Providers instantiated via setApiKey');
  }

  const instance = providers.get(provider);
  if (!instance) {
    log.error(`Provider ${provider} not found`);
    return false;
  }

  // Validation format seulement (pas d'appel réseau pour économiser le quota)
  if (!key || key.trim().length < 10) {
    log.error(`API key too short for ${provider}`);
    return false;
  }
  instance.setApiKey(key.trim());
  log.info(`✅ API key saved for ${provider} (format OK, ${key.trim().length} chars)`);

  await setSetting(`api_key_${provider}`, key);

  // Forcer ce provider comme preferred
  preferredProvider = provider;
  await setSetting('preferred_provider', provider);

  // Mettre à jour le fallback
  updateFallbackOrder();

  // Marquer comme initialisé
  isInitialized = true;

  log.info(`✅ API key set for ${provider}, preferred: ${preferredProvider}, fallback: [${fallbackOrder.join(',')}], available: [${getAvailableProviders().join(',')}]`);
  return true;
}

export async function setPreferredProvider(provider: LLMProviderName): Promise<void> {
  preferredProvider = provider;
  await setSetting('preferred_provider', provider);
  updateFallbackOrder();
  log.info(`Preferred provider: ${provider}`);
}

export async function setProviderModel(provider: LLMProviderName, model: string): Promise<void> {
  PROVIDER_MODELS[provider] = model;
  await setSetting(`model_${provider}`, model);
  log.info(`Model for ${provider}: ${model}`);
}

// ============================================================
// GETTERS
// ============================================================

export function getPreferredProvider(): LLMProviderName {
  return preferredProvider;
}

export function getAvailableProviders(): LLMProviderName[] {
  // SYNC check — juste vérifier si la clé existe (pas de network call)
  return Array.from(providers.entries())
    .filter(([_, p]) => !!p.getApiKey())
    .map(([name]) => name);
}

export function getAllSupportedProviders(): Array<{
  name: LLMProviderName;
  label: string;
  model: string;
  isConfigured: boolean;
  isPreferred: boolean;
}> {
  const providerLabels: Record<LLMProviderName, string> = {
    gemini: '⚡ Gemini',
    claude: '🟣 Claude',
    openai: '🟢 OpenAI',
    deepseek: '🔵 DeepSeek',
    perplexity: '🔍 Perplexity',
  };

  return (Object.keys(PROVIDER_MODELS) as LLMProviderName[]).map(name => ({
    name,
    label: providerLabels[name] || name,
    model: PROVIDER_MODELS[name],
    isConfigured: !!providers.get(name)?.getApiKey(),
    isPreferred: name === preferredProvider,
  }));
}

export function getLLMStats(): LLMStats {
  return { ...stats };
}

// ============================================================
// HELPERS
// ============================================================

function ensureInitialized(): void {
  if (!isInitialized) {
    log.warn('LLM not initialized — forcing provider instantiation');
    if (providers.size === 0) {
      providers.set('gemini', new GeminiProvider());
      providers.set('claude', new ClaudeProvider());
      providers.set('openai', createOpenAIProvider());
      providers.set('deepseek', createDeepSeekProvider());
      providers.set('perplexity', createPerplexityProvider());
    }
    updateFallbackOrder();
    isInitialized = true;
  }
}

function isValidProvider(name: string): boolean {
  return ['gemini', 'claude', 'openai', 'deepseek', 'perplexity'].includes(name);
}

function buildProviderOrder(
  specific?: LLMProviderName,
  skipFallback?: boolean,
): LLMProviderName[] {
  if (specific) return [specific];
  if (skipFallback) return [preferredProvider];
  return fallbackOrder;
}

function updateFallbackOrder(): void {
  // Preferred d'abord, puis les autres disponibles
  const available = getAvailableProviders();
  const order: LLMProviderName[] = [];

  if (available.includes(preferredProvider)) {
    order.push(preferredProvider);
  }

  // Ajouter les fallbacks dans l'ordre par défaut
  const defaultOrder: LLMProviderName[] = ['gemini', 'deepseek', 'openai', 'claude', 'perplexity'];
  for (const name of defaultOrder) {
    if (!order.includes(name) && available.includes(name)) {
      order.push(name);
    }
  }

  fallbackOrder = order.length > 0 ? order : ['gemini'];
}

function recordSuccess(providerName: LLMProviderName, response: LLMResponse): void {
  stats.totalRequests++;
  stats.totalTokens += response.tokensUsed || 0;
  totalLatencyMs += response.latencyMs || 0;
  stats.averageLatencyMs = Math.round(totalLatencyMs / stats.totalRequests);
  stats.lastProvider = providerName;
  stats.providerUsage[providerName] = (stats.providerUsage[providerName] || 0) + 1;
  updateSuccessRate();
}

function updateSuccessRate(): void {
  if (stats.totalRequests === 0) {
    stats.successRate = 100;
  } else {
    stats.successRate = Math.round(
      ((stats.totalRequests - stats.totalErrors) / stats.totalRequests) * 100,
    );
  }
}

function generateFallbackMessage(): string {
  const messages = [
    "Je... je n'arrive pas à penser clairement en ce moment. Réessaie ?",
    'Mes circuits sont un peu embrouillés... donne-moi un moment.',
    "Hmm, quelque chose bloque dans ma tête. Tu peux reformuler ?",
    "Oups, j'ai eu un petit bug. On réessaie ?",
    "Le signal est faible... je suis là mais j'ai du mal à répondre.",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}


export async function hasAnyApiKey(): Promise<boolean> {
  const providers: LLMProviderName[] = ['gemini', 'claude', 'openai', 'deepseek', 'perplexity'];
  for (const name of providers) {
    const key = await getSetting(`api_key_${name}`);
    if (key && key.trim().length > 5) return true;
  }
  return false;
}
