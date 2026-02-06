// src/types/conversation.ts
// Système de conversation — MVP COMPLET

import { EmotionType } from './emotion';
import { HormoneLevels } from './hormone';

// ============================================================
// RÔLES
// ============================================================
export type MessageRole = 'user' | 'assistant' | 'system';

// ============================================================
// MESSAGE
// ============================================================
export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  
  // Méta LLM
  tokensUsed?: number;
  generationTimeMs?: number;
  provider?: string;          // gemini, claude, openai, mistral, local
  
  // État au moment du message
  emotionAtTime?: EmotionType;
  hormoneSnapshot?: HormoneLevels;
  
  // Flags
  isEdited: boolean;
  isRegenerated: boolean;
  
  createdAt: string;
}

// ============================================================
// CONVERSATION
// ============================================================
export interface Conversation {
  id: string;
  tamadachiId: string;
  title: string | null;
  summary: string | null;
  topics: string[];
  mood: string;
  
  // Stats
  messageCount: number;
  xpEarned: number;
  memoriesCreated: number;
  
  // Lifecycle
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  endReason: string | null;
}

// ============================================================
// CONTEXTE POUR LE LLM
// ============================================================
export interface ConversationContext {
  tamadachiName: string;
  stage: string;
  emotion: EmotionType;
  personality: {
    social: number;
    cognitive: number;
    emotional: number;
    energy: number;
    creativity: number;
  };
  hormones: HormoneLevels;
  recentMessages: Message[];
  relevantMemories: string[];
  userPreferences: {
    name?: string;
    interests?: string[];
  };
  sensorContext: {
    batteryLevel?: number;
    isCharging?: boolean;
    timeOfDay?: string;
    isOnline?: boolean;
  };
}

// ============================================================
// RÉSULTAT CHAT
// ============================================================
export interface ChatResult {
  response: string;
  source: string;           // Provider utilisé
  latency: number;          // Temps de réponse en ms
  tokensUsed?: number;
  emotion?: EmotionType;    // Émotion détectée dans la réponse
}
