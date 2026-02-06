// Re-export services — avoid naming conflicts
export * from './database';
export * from './llm';
export * from './sensors';
// Core services: import directly to avoid conflicts
// e.g. import { processUserMessage } from '../services/core/ConversationService';
