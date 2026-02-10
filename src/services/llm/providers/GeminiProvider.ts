// src/services/llm/providers/GeminiProvider.ts
// Provider LLM pour Google Gemini — MVP COMPLET
//
// Gemini est le provider par défaut car :
// - API gratuite avec limites généreuses
// - Modèle performant (gemini-2.0-flash)
// - Bonne compréhension du français
//
// Ce provider implémente l'interface commune LLMProvider
// et gère l'appel HTTP direct à l'API Gemini.

import {
  LLMProviderInstance,
  LLMProviderName,
  LLMRequest,
  LLMResponse,
  
  LLMMessage,
} from '../../../types';
import { LLM_CONFIG } from '../../../constants/config';
import { createLogger, now } from '../../../utils/helpers';

// Timeout compatible JSC (pas de AbortSignal.timeout en React Native)
function createTimeout(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

const log = createLogger('Gemini');

// ============================================================
// CONFIG
// ============================================================

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.0-flash';

// ============================================================
// PROVIDER
// ============================================================

export class GeminiProvider implements LLMProviderInstance {
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model?: string) {
    this.apiKey = apiKey || '';
    this.model = model || DEFAULT_MODEL;
    log.info(`Gemini provider initialized — Model: ${this.model}`);
  }

  /**
   * Vérifie si le provider est disponible (clé API valide)
   */
  readonly name: LLMProviderName = 'gemini';

  setApiKey(key: string): void {
    this.apiKey = key;
  }

  getApiKey(): string | null {
    return this.apiKey || null;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || this.apiKey.length < 10) return false;

    try {
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${this.model}?key=${this.apiKey}`,
        { method: 'GET' },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Envoie un message au LLM et retourne la réponse
   */
  async generate(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // Construire le body de la requête Gemini
      const body = this.buildRequestBody(request);

      log.info(`Sending request — Model: ${this.model}, Messages: ${(request.messages.length + 2)}`);

      // Appel HTTP
      const response = await fetch(
        `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: createTimeout(LLM_CONFIG.timeout).signal,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        log.error(`API error ${response.status}:`, errorText);
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const generationTime = Date.now() - startTime;

      // Extraire la réponse
      const result = this.parseResponse(data, generationTime);

      log.info(`Response received — ${result.tokensUsed} tokens, ${generationTime}ms`);
      return result;

    } catch (error: any) {
      const generationTime = Date.now() - startTime;
      log.error(`Generation failed after ${generationTime}ms:`, error.message);

      // Retourner une réponse d'erreur
      return {
        content: '',
        tokensUsed: 0,
        latencyMs: generationTime,
        provider: 'gemini' as LLMProviderName,
        model: this.model,
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Stream la réponse (pour affichage progressif)
   */
  async *stream(request: LLMRequest): AsyncGenerator<string, LLMResponse> {
    const startTime = Date.now();
    let fullContent = '';
    let tokensUsed = 0;

    try {
      const body = this.buildRequestBody(request);

      const response = await fetch(
        `${GEMINI_API_BASE}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: createTimeout(LLM_CONFIG.timeout).signal,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(jsonStr);
            const text = chunk?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullContent += text;
              yield text;
            }

            // Récupérer les tokens
            const usage = chunk?.usageMetadata;
            if (usage?.totalTokenCount) {
              tokensUsed = usage.totalTokenCount;
            }
          } catch {
            // Chunk JSON invalide, ignorer
          }
        }
      }

      const generationTime = Date.now() - startTime;
      log.info(`Stream complete — ${tokensUsed} tokens, ${generationTime}ms`);

      return {
        content: fullContent,
        tokensUsed,
        latencyMs: generationTime,
        provider: 'gemini' as LLMProviderName,
        model: this.model,
        success: true,
      };

    } catch (error: any) {
      const generationTime = Date.now() - startTime;
      log.error(`Stream failed after ${generationTime}ms:`, error.message);

      return {
        content: fullContent,
        tokensUsed,
        latencyMs: generationTime,
        provider: 'gemini' as LLMProviderName,
        model: this.model,
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================
  // CONSTRUCTION DE LA REQUÊTE
  // ============================================================

  private buildRequestBody(request: LLMRequest): any {
    // Séparer le system prompt des messages
    const systemContent = request.systemPrompt || '';
    const chatMessages = [...request.messages, { role: 'user' as const, content: request.userMessage, attachments: request.userAttachments }];

    // Convertir au format Gemini (avec support images)
    const contents = chatMessages.map(msg => {
      const parts: any[] = [];
      // Ajouter les images en premier
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.type === 'image' && att.imageBase64) {
            parts.push({
              inlineData: {
                mimeType: att.mimeType || 'image/jpeg',
                data: att.imageBase64,
              },
            });
          }
        }
      }
      // Puis le texte
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts,
      };
    });

    const body: any = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? LLM_CONFIG.defaultParams.temperature,
        maxOutputTokens: request.maxTokens ?? LLM_CONFIG.defaultParams.maxTokens,
        topK: LLM_CONFIG.defaultParams.topK,
      },
    };

    // System instruction (Gemini le gère séparément)
    if (systemContent) {
      body.systemInstruction = {
        parts: [{ text: systemContent }],
      };
    }

    // Safety settings (permissifs pour une conversation naturelle)
    body.safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ];

    return body;
  }

  // ============================================================
  // PARSING DE LA RÉPONSE
  // ============================================================

  private parseResponse(data: any, generationTime: number): LLMResponse {
    const candidates = data?.candidates;
    if (!candidates || candidates.length === 0) {
      // Vérifier si c'est un blocage de sécurité
      const blockReason = data?.promptFeedback?.blockReason;
      if (blockReason) {
        return {
          content: '',
          tokensUsed: 0,
          latencyMs: generationTime,
          provider: 'gemini' as LLMProviderName,
          model: this.model,
          success: false,
          error: `Blocked by safety: ${blockReason}`,
        };
      }

      return {
        content: '',
        tokensUsed: 0,
        latencyMs: generationTime,
        provider: 'gemini' as LLMProviderName,
        model: this.model,
        success: false,
        error: 'No candidates in response',
      };
    }

    const candidate = candidates[0];
    const content = candidate.content?.parts?.[0]?.text || '';
    const finishReason = candidate.finishReason;

    // Tokens
    const usage = data.usageMetadata;
    const tokensUsed = usage?.totalTokenCount || 0;

    // Vérifier la raison de fin
    if (finishReason === 'SAFETY') {
      return {
        content: '',
        tokensUsed,
        latencyMs: generationTime,
        provider: 'gemini' as LLMProviderName,
        model: this.model,
        success: false,
        error: 'Response blocked by safety filters',
      };
    }

    return {
      content,
      tokensUsed,
      latencyMs: generationTime,
      provider: 'gemini' as LLMProviderName,
      model: this.model,
      success: true,
    };
  }
}
