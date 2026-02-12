// src/services/sensors/VoiceService.ts
// Service Vocal — La voix du TamadachAI
//
// STT: expo-speech-recognition (écoute la voix de l'humain)
// TTS: expo-speech (fait parler le TamadachAI)

import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { createLogger } from '../../utils/helpers';

const log = createLogger('Voice');

// ============================================================
// ÉTAT
// ============================================================

let isListening = false;
let isSpeaking = false;
let voiceModeActive = false;
let ttsVoiceId: string | null = null;

// Callbacks
let onTranscript: ((text: string, isFinal: boolean) => void) | null = null;
let onListeningChange: ((listening: boolean) => void) | null = null;
let onSpeakingChange: ((speaking: boolean) => void) | null = null;

// ============================================================
// INITIALISATION
// ============================================================

export async function initVoice(): Promise<boolean> {
  try {
    const available = await ExpoSpeechRecognitionModule.isRecognitionAvailable();
    if (!available) {
      log.warn('Speech recognition not available');
      return false;
    }

    // Trouver une bonne voix française pour TTS
    const voices = await Speech.getAvailableVoicesAsync();
    const frenchVoice = voices.find(v => 
      v.language.startsWith('fr') && v.quality === 'Enhanced'
    ) || voices.find(v => 
      v.language.startsWith('fr')
    );
    if (frenchVoice) {
      ttsVoiceId = frenchVoice.identifier;
      log.info(`🎤 Voice init OK — TTS voice: ${frenchVoice.name} (${frenchVoice.language})`);
    } else {
      log.info('🎤 Voice init OK — using default TTS voice');
    }

    return true;
  } catch (e) {
    log.error('Voice init failed:', e);
    return false;
  }
}

// ============================================================
// SPEECH-TO-TEXT (écouter)
// ============================================================

export async function startListening(): Promise<void> {
  if (isListening) return;

  try {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      log.warn('Microphone permission denied');
      return;
    }

    // Arrêter le TTS si en cours
    if (isSpeaking) {
      await stopSpeaking();
    }

    ExpoSpeechRecognitionModule.start({
      lang: 'fr-FR',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
    });

    isListening = true;
    onListeningChange?.(true);
    log.info('🎤 Listening started');
  } catch (e) {
    log.error('Start listening failed:', e);
    isListening = false;
    onListeningChange?.(false);
  }
}

export async function stopListening(): Promise<void> {
  if (!isListening) return;
  try {
    ExpoSpeechRecognitionModule.stop();
  } catch (e) {
    log.warn('Stop listening error:', e);
  }
  isListening = false;
  onListeningChange?.(false);
  log.info('🎤 Listening stopped');
}

// ============================================================
// TEXT-TO-SPEECH (parler)
// ============================================================

export async function speak(text: string): Promise<void> {
  if (!text) return;

  // Nettoyer le texte (enlever les emojis excessifs, markdown)
  const cleanText = text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/#{1,3}\s/g, '')
    .replace(/[🎤🎙️💬💭🌙☀️📊⚙️📎✨⭐]/g, '')
    .trim();

  if (!cleanText) return;

  try {
    isSpeaking = true;
    onSpeakingChange?.(true);

    await Speech.speak(cleanText, {
      language: 'fr-FR',
      voice: ttsVoiceId || undefined,
      pitch: 1.05,
      rate: 1.0,
      onDone: () => {
        isSpeaking = false;
        onSpeakingChange?.(false);
        // En mode conversation vocale, réécouter automatiquement
        if (voiceModeActive) {
          setTimeout(() => startListening(), 500);
        }
      },
      onStopped: () => {
        isSpeaking = false;
        onSpeakingChange?.(false);
      },
      onError: () => {
        isSpeaking = false;
        onSpeakingChange?.(false);
      },
    });

    log.info(`🔊 Speaking: "${cleanText.substring(0, 40)}..."`);
  } catch (e) {
    log.error('Speak failed:', e);
    isSpeaking = false;
    onSpeakingChange?.(false);
  }
}

export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch (e) {
    log.warn('Stop speaking error:', e);
  }
  isSpeaking = false;
  onSpeakingChange?.(false);
}

// ============================================================
// MODE CONVERSATION VOCALE
// ============================================================

export function setVoiceMode(active: boolean): void {
  voiceModeActive = active;
  log.info(`🎤 Voice mode: ${active ? 'ON' : 'OFF'}`);
}

export function isVoiceMode(): boolean {
  return voiceModeActive;
}

// ============================================================
// CALLBACKS
// ============================================================

export function setOnTranscript(cb: (text: string, isFinal: boolean) => void): void {
  onTranscript = cb;
}

export function setOnListeningChange(cb: (listening: boolean) => void): void {
  onListeningChange = cb;
}

export function setOnSpeakingChange(cb: (speaking: boolean) => void): void {
  onSpeakingChange = cb;
}

// Fonction pour être appelée par les event handlers dans le composant React
export function handleSpeechResult(transcript: string, isFinal: boolean): void {
  onTranscript?.(transcript, isFinal);
  if (isFinal) {
    isListening = false;
    onListeningChange?.(false);
  }
}

export function handleSpeechEnd(): void {
  isListening = false;
  onListeningChange?.(false);
}

export function handleSpeechError(error: string): void {
  log.warn('Speech error:', error);
  isListening = false;
  onListeningChange?.(false);
}

// ============================================================
// GETTERS
// ============================================================

export function getIsListening(): boolean { return isListening; }
export function getIsSpeaking(): boolean { return isSpeaking; }
