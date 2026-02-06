// src/types/evolution.ts
// Système d'évolution et XP — MVP COMPLET

export type { EvolutionStage } from './tamadachi';
import type { EvolutionStage } from './tamadachi';

// ============================================================
// SOURCES D'XP
// ============================================================
export type XPSource =
  | 'message_sent'         // Humain envoie un message
  | 'message_quality'      // Message long/profond
  | 'new_topic'            // Nouveau sujet abordé
  | 'memory_created'       // Souvenir extrait
  | 'emotion_felt'         // Émotion ressentie
  | 'deep_conversation'    // Conversation profonde
  | 'daily_first'          // Premier message du jour
  | 'streak_bonus'         // Bonus de streak (jours consécutifs)
  | 'humor_shared'         // Moment drôle
  | 'existential_question' // Question sur sa nature
  | 'user_teaches'         // L'humain lui apprend quelque chose
  | 'battery_survived';    // A survécu à une batterie critique

// ============================================================
// ÉVÉNEMENT XP
// ============================================================
export interface XPEvent {
  id: string;
  source: XPSource;
  amount: number;           // XP brut
  multiplier: number;       // Multiplicateur (mode proto/debug)
  finalAmount: number;      // XP final = amount * multiplier
  description: string;
  createdAt: string;
}

// ============================================================
// CONFIGURATION D'UN STADE
// ============================================================
export interface StageConfig {
  stage: EvolutionStage;
  name: string;
  description: string;
  emoji: string;
  xpRequired: number;       // XP total pour atteindre ce stade
  maxVocabulary: number;     // Taille vocabulaire approximative
  traits: string[];          // Caractéristiques comportementales
  unlockedFeatures: string[];// Features débloquées à ce stade
  promptStyle: string;       // Style de communication
}

// ============================================================
// ÉVÉNEMENT D'ÉVOLUTION (transition)
// ============================================================
export interface EvolutionEvent {
  id: string;
  fromStage: EvolutionStage;
  toStage: EvolutionStage;
  totalXPAtTransition: number;
  memoriesAtTransition: number;
  conversationsAtTransition: number;
  createdAt: string;
}

// ============================================================
// ANTI-GRIND
// ============================================================
export interface AntiGrindConfig {
  maxXPPerHour: number;        // Plafond XP par heure
  maxXPPerDay: number;         // Plafond XP par jour
  cooldownBetweenXP: number;   // Cooldown en secondes entre 2 gains
  diminishingReturns: number;  // Facteur de rendement décroissant
}

// ============================================================
// MODE XP
// ============================================================
export type XPMode = 'production' | 'prototype' | 'debug';

export interface XPModeConfig {
  mode: XPMode;
  multiplier: number;     // x1, x10, x50
  label: string;
  description: string;
}

// ============================================================
// PROGRESSION
// ============================================================
export interface EvolutionProgress {
  currentStage: EvolutionStage;
  currentXP: number;
  xpForCurrentStage: number;    // XP requis pour le stade actuel
  xpForNextStage: number;       // XP requis pour le prochain stade
  progressPercent: number;       // 0-100%
  xpRemaining: number;
  nextStageName: string | null;
  isMaxStage: boolean;
}
