// src/hooks/useVoice.ts
// Hook React pour la reconnaissance vocale

import { useState, useEffect, useCallback } from 'react';
import { useSpeechRecognitionEvent } from 'expo-speech-recognition';
import {
  startListening,
  stopListening,
  speak,
  stopSpeaking,
  handleSpeechResult,
  handleSpeechEnd,
  handleSpeechError,
  setVoiceMode,
  isVoiceMode,
} from '../services/sensors/VoiceService';

export function useVoice(onFinalTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [voiceMode, setVoiceModeState] = useState(false);

  // Écouter les résultats de reconnaissance
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript || '';
    const isFinal = event.isFinal;
    
    setPartialText(transcript);
    handleSpeechResult(transcript, isFinal);
    
    if (isFinal && transcript.trim()) {
      setListening(false);
      setPartialText('');
      onFinalTranscript(transcript.trim());
    }
  });

  useSpeechRecognitionEvent('end', () => {
    handleSpeechEnd();
    setListening(false);
  });

  useSpeechRecognitionEvent('error', (event) => {
    handleSpeechError(event.error);
    setListening(false);
    setPartialText('');
  });

  const toggleListening = useCallback(async () => {
    if (listening) {
      await stopListening();
      setListening(false);
    } else {
      setPartialText('');
      await startListening();
      setListening(true);
    }
  }, [listening]);

  const speakText = useCallback(async (text: string) => {
    await speak(text);
    setSpeaking(true);
  }, []);

  const stopSpeak = useCallback(async () => {
    await stopSpeaking();
    setSpeaking(false);
  }, []);

  const toggleVoiceMode = useCallback(() => {
    const newState = !voiceMode;
    setVoiceModeState(newState);
    setVoiceMode(newState);
  }, [voiceMode]);

  return {
    listening,
    speaking,
    partialText,
    voiceMode,
    toggleListening,
    speakText,
    stopSpeak,
    toggleVoiceMode,
  };
}
