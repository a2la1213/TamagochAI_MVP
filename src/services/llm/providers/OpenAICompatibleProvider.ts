// src/services/llm/providers/OpenAICompatibleProvider.ts
// Provider de base pour toutes les API OpenAI-compatibles
//
// Ce provider est réutilisé par :
// - OpenAI (gpt-5.2)
// - DeepSeek (deepseek-chat / V3.2)
// - Perplexity (sonar-pro)
//
// Le format de requête est identique pour ces 3 providers.
// Seuls l'URL de base, le modèle et la clé API changent.

import {
  LLMProviderInstance,
  LLMProviderName,
  LLMRequest,
  LLMResponse,
  LLMMessage,
} from '../../../types';
import { LLM_CONFIG } from '../../../constants/config';
import { createLogger } from '../../../utils/helpers';

const FETCH_TIMEOUT = 30000; // 30s max par requête

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}


// Timeout compatible JSC (pas de AbortSignal.timeout en React Native)
function createTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export interface OpenAICompatibleConfig {
  name: LLMProviderName;
  apiBase: string;
  model: string;
  apiKey: string;
  // Certains providers ont des particularités
  supportsSystemRole?: boolean;     // Tous le supportent sauf si précisé
  extraHeaders?: Record<string, string>;
  extraBodyParams?: Record<string, any>;
}

export class OpenAICompatibleProvider implements LLMProviderInstance {
  readonly name: LLMProviderName;
  private config: OpenAICompatibleConfig;
  private log;

  constructor(config: OpenAICompatibleConfig) {
    this.config = config;
    this.name = config.name;
    this.log = createLogger(config.name);
    this.log.info(`${config.name} provider initialized — Model: ${config.model}`);
  }

  setApiKey(key: string): void {
    this.config = { ...this.config, apiKey: key };
  }

  getApiKey(): string | null {
    return this.config.apiKey || null;
  }

    async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey && this.config.apiKey.length >= 10;
  }


  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const body = this.buildRequestBody(request);

      this.log.info(`Sending request — Model: ${this.config.model}, Messages: ${(request.messages.length + 2)}`);

      const response = await fetchWithTimeout(`${this.config.apiBase}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: createTimeout(LLM_CONFIG.timeout).signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.log.error(`API error ${response.status}:`, errorText);
        throw new Error(`${this.config.name} API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const generationTime = Date.now() - startTime;

      return this.parseResponse(data, generationTime);

    } catch (error: any) {
      const generationTime = Date.now() - startTime;
      this.log.error(`Generation failed after ${generationTime}ms:`, error.message);
      return {
        content: '',
        tokensUsed: 0,
        latencyMs: generationTime,
        provider: this.config.name as LLMProviderName,
        model: this.config.model,
        success: false,
        error: error.message,
      };
    }
  }

  async *stream(request: LLMRequest): AsyncGenerator<string, LLMResponse> {
    const startTime = Date.now();
    let fullContent = '';
    let tokensUsed = 0;

    try {
      const body = { ...this.buildRequestBody(request), stream: true };

      const response = await fetchWithTimeout(`${this.config.apiBase}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: createTimeout(LLM_CONFIG.timeout).signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${this.config.name} API error ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(jsonStr);
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              yield delta;
            }

            // Tokens (si fournis dans le stream)
            if (chunk.usage?.total_tokens) {
              tokensUsed = chunk.usage.total_tokens;
            }
          } catch {
            // Chunk invalide
          }
        }
      }

      const generationTime = Date.now() - startTime;
      return {
        content: fullContent,
        tokensUsed,
        latencyMs: generationTime,
        provider: this.config.name as LLMProviderName,
        model: this.config.model,
        success: true,
      };

    } catch (error: any) {
      const generationTime = Date.now() - startTime;
      return {
        content: fullContent,
        tokensUsed,
        latencyMs: generationTime,
        provider: this.config.name as LLMProviderName,
        model: this.config.model,
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================
  // FORMAT OPENAI STANDARD
  // ============================================================

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...(this.config.extraHeaders || {}),
    };
  }

  private buildRequestBody(request: LLMRequest): any {
    // Format standard OpenAI chat/completions (avec support vision)
    const allMsgs = [
      ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt, attachments: undefined as any }] : []),
      ...request.messages,
      { role: 'user' as const, content: request.userMessage, attachments: request.userAttachments },
    ];
    const messages = allMsgs.map((msg: any) => {
      // Si le message a des images, utiliser le format multimodal OpenAI
      if (msg.attachments && msg.attachments.length > 0) {
        const parts: any[] = [{ type: 'text', text: msg.content }];
        for (const att of msg.attachments) {
          if (att.type === 'image' && att.imageBase64) {
            // Strip le prefix data:... si déjà présent
            let base64Data = att.imageBase64;
            if (base64Data.startsWith('data:')) {
              // Déjà au bon format
              parts.push({ type: 'image_url', image_url: { url: base64Data } });
            } else {
              const mimeType = att.mimeType || 'image/jpeg';
              parts.push({ type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64Data } });
            }
          }
        }
        return { role: msg.role, content: parts };
      }
      return { role: msg.role, content: msg.content };
    });

    // Si le provider ne supporte pas le rôle system, fusionner avec le premier user message
    if (this.config.supportsSystemRole === false) {
      const systemIdx = messages.findIndex(m => m.role === 'system');
      if (systemIdx >= 0) {
        const systemContent = messages[systemIdx].content;
        messages.splice(systemIdx, 1);
        if (messages.length > 0 && messages[0].role === 'user') {
          messages[0].content = `${systemContent}\n\n${messages[0].content}`;
        } else {
          messages.unshift({ role: 'user', content: systemContent });
        }
      }
    }

    return {
      model: this.config.model,
      messages,
      temperature: request.temperature ?? LLM_CONFIG.defaultParams.temperature,
      max_tokens: Math.min(request.maxTokens ?? LLM_CONFIG.defaultParams.maxTokens, this.config.name === 'groq' ? 4096 : 8192),
      ...(this.config.extraBodyParams || {}),
    };
  }

  private parseResponse(data: any, generationTime: number): LLMResponse {
    const choice = data.choices?.[0];
    const content = choice?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    if (!content && choice?.finish_reason === 'content_filter') {
      return {
        content: '',
        tokensUsed,
        latencyMs: generationTime,
        provider: this.config.name as LLMProviderName,
        model: this.config.model,
        success: false,
        error: 'Response blocked by content filter',
      };
    }

    return {
      content,
      tokensUsed,
      latencyMs: generationTime,
      provider: this.config.name as LLMProviderName,
      model: this.config.model,
      success: !!content,
      error: content ? undefined : 'Empty response',
    };
  }
}

// ============================================================
// FACTORY FUNCTIONS — Créent les providers en une ligne
// ============================================================

/**
 * Crée un provider OpenAI (GPT-5.2)
 */
export function createOpenAIProvider(apiKey: string = '', model?: string): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    name: 'openai' as LLMProviderName,
    apiBase: 'https://api.openai.com/v1',
    model: model || 'gpt-4o',
    apiKey,
  });
}

/**
 * Crée un provider DeepSeek (V3.2)
 */
export function createDeepSeekProvider(apiKey: string = '', model?: string): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    name: 'deepseek' as LLMProviderName,
    apiBase: 'https://api.deepseek.com',
    model: model || 'deepseek-chat',
    apiKey,
  });
}

/**
 * Crée un provider Perplexity (Sonar Pro)
 */
export function createPerplexityProvider(apiKey: string = '', model?: string): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    name: 'perplexity' as LLMProviderName,
    apiBase: 'https://api.perplexity.ai',
    model: model || 'sonar-pro',
    apiKey,
  });
}


/**
 * Crée un provider Groq (Llama 3.3 70B — ultra rapide, 14400 RPD gratuit)
 * API 100% compatible OpenAI
 */
export function createGroqProvider(apiKey: string = '', model?: string): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    name: 'groq' as LLMProviderName,
    apiBase: 'https://api.groq.com/openai/v1',
    model: model || 'meta-llama/llama-4-scout-17b-16e-instruct',
    apiKey,
  });
}
