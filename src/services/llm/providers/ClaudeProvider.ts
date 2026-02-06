// src/services/llm/providers/ClaudeProvider.ts
// Provider LLM pour Anthropic Claude — MVP COMPLET
//
// Claude utilise un format d'API CUSTOM (Messages API)
// différent du format OpenAI. Auth via x-api-key header.
//
// Modèle par défaut : claude-sonnet-4-5-20250929
// (dernier Sonnet stable à date de février 2026)

import {
  LLMProviderInstance,
  LLMProviderName,
  LLMRequest,
  LLMResponse,
  LLMMessage,
} from '../../../types';
import { LLM_CONFIG } from '../../../constants/config';
import { createLogger } from '../../../utils/helpers';

// Timeout compatible JSC (pas de AbortSignal.timeout en React Native)
function createTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

const log = createLogger('Claude');

const CLAUDE_API_BASE = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-5-20250929';
const ANTHROPIC_VERSION = '2023-06-01';

export class ClaudeProvider implements LLMProviderInstance {
  readonly name: LLMProviderName = 'claude';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || '';
    this.model = model || DEFAULT_MODEL;
    log.info(`Claude provider initialized — Model: ${this.model}`);
  }

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  getApiKey(): string | null {
    return this.apiKey || null;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || this.apiKey.length < 10) return false;
    try {
      // Petit appel de test avec max_tokens minimal
      const response = await fetch(CLAUDE_API_BASE, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      return response.ok || response.status === 429; // 429 = rate limited mais clé valide
    } catch {
      return false;
    }
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const body = this.buildRequestBody(request);

      log.info(`Sending request — Model: ${this.model}, Messages: ${(request.messages.length + 2)}`);

      const response = await fetch(CLAUDE_API_BASE, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: createTimeout(LLM_CONFIG.timeout).signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error(`API error ${response.status}:`, errorText);
        throw new Error(`Claude API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const generationTime = Date.now() - startTime;

      return this.parseResponse(data, generationTime);

    } catch (error: any) {
      const generationTime = Date.now() - startTime;
      log.error(`Generation failed after ${generationTime}ms:`, error.message);
      return {
        content: '',
        tokensUsed: 0,
        latencyMs: generationTime,
        provider: 'claude' as LLMProviderName,
        model: this.model,
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

      const response = await fetch(CLAUDE_API_BASE, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: createTimeout(LLM_CONFIG.timeout).signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Claude API error ${response.status}: ${errorText}`);
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
            const event = JSON.parse(jsonStr);

            // Claude stream events
            if (event.type === 'content_block_delta' && event.delta?.text) {
              fullContent += event.delta.text;
              yield event.delta.text;
            }
            if (event.type === 'message_delta' && event.usage) {
              tokensUsed = (event.usage.input_tokens || 0) + (event.usage.output_tokens || 0);
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
        provider: 'claude' as LLMProviderName,
        model: this.model,
        success: true,
      };

    } catch (error: any) {
      const generationTime = Date.now() - startTime;
      return {
        content: fullContent,
        tokensUsed,
        latencyMs: generationTime,
        provider: 'claude' as LLMProviderName,
        model: this.model,
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================
  // FORMAT ANTHROPIC (Messages API)
  // ============================================================

  private buildRequestBody(request: LLMRequest): any {
    const systemContent = request.systemPrompt || '';
    const chatMessages = [...request.messages, { role: 'user' as const, content: request.userMessage }];

    // Claude attend un format spécifique : system séparé, messages alternés user/assistant
    const messages = chatMessages.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    const body: any = {
      model: this.model,
      max_tokens: request.maxTokens ?? LLM_CONFIG.defaultParams.maxTokens,
      temperature: request.temperature ?? LLM_CONFIG.defaultParams.temperature,
      top_p: request.topP ?? LLM_CONFIG.defaultParams.topP,
      messages,
    };

    // System prompt en paramètre séparé (pas dans messages)
    if (systemContent) {
      body.system = systemContent;
    }

    return body;
  }

  private parseResponse(data: any, generationTime: number): LLMResponse {
    const content = data.content?.[0]?.text || '';
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;

    if (data.stop_reason === 'error' || !content) {
      return {
        content: '',
        tokensUsed: inputTokens + outputTokens,
        latencyMs: generationTime,
        provider: 'claude' as LLMProviderName,
        model: this.model,
        success: false,
        error: data.error?.message || 'Empty response',
      };
    }

    return {
      content,
      tokensUsed: inputTokens + outputTokens,
      latencyMs: generationTime,
      provider: 'claude' as LLMProviderName,
      model: this.model,
      success: true,
    };
  }
}
