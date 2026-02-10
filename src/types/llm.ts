// src/types/llm.ts
// Types LLM — MVP COMPLET v2

// ============================================================
// PROVIDERS — NOM (string union pour le store/config)
// ============================================================
export type LLMProviderName =
  | 'gemini'
  | 'claude'
  | 'openai'
  | 'deepseek'
  | 'perplexity';

// Legacy alias (rétrocompatibilité)
export type LLMProvider = LLMProviderName;

// ============================================================
// PROVIDER INSTANCE (interface pour les classes de providers)
// ============================================================
export interface LLMProviderInstance {
  name: LLMProviderName;
  isAvailable(): boolean | Promise<boolean>;
  setApiKey(key: string): void;
  getApiKey(): string | null;
  generate(request: LLMRequest): Promise<LLMResponse>;
  generateStream?(request: LLMRequest): AsyncGenerator<string, LLMResponse, unknown>;
  validateApiKey?(key: string): Promise<boolean>;
}

// ============================================================
// MESSAGE
// ============================================================
export interface LLMContentPart {
  type: 'text' | 'image';
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: LLMContentPart[];
}

// ============================================================
// CONFIG PROVIDER
// ============================================================
export interface ProviderConfig {
  provider: LLMProviderName;
  name: string;
  icon: string;
  model: string;
  isPaid: boolean;
  isLocal: boolean;
  description: string;
  maxTokens: number;
}

// ============================================================
// MODÈLES LOCAUX
// ============================================================
export type LocalModelId = 'mistral-7b' | 'phi3-mini';

export interface LocalModelConfig {
  id: LocalModelId;
  name: string;
  filename: string;
  size: string;
  sizeBytes: number;
  ramRequired: string;
  quality: number;
  promptTemplate: 'mistral' | 'phi3' | 'generic';
  description: string;
}

// ============================================================
// ÉTAT DU LLM
// ============================================================
export interface LLMStatus {
  isInitialized: boolean;
  currentProvider: LLMProviderName;
  availableProviders: LLMProviderName[];
  isGenerating: boolean;
  lastError: string | null;
}

// ============================================================
// REQUÊTE LLM
// ============================================================
export interface LLMRequest {
  systemPrompt: string;
  messages: LLMMessage[];
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
  userAttachments?: LLMContentPart[];
}

// ============================================================
// RÉPONSE LLM
// ============================================================
export interface LLMResponse {
  success: boolean;
  content: string;
  provider: LLMProviderName;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  error?: string;
  finishReason?: 'stop' | 'length' | 'error';
}

// ============================================================
// OPTIONS DE GÉNÉRATION (raccourci pour le store)
// ============================================================
export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

// ============================================================
// STATS LLM
// ============================================================
export interface LLMStats {
  totalRequests: number;
  totalErrors: number;
  totalTokens: number;
  averageLatencyMs: number;
  successRate: number;
  lastProvider: LLMProviderName | null;
  providerUsage: Record<string, number>;
}
