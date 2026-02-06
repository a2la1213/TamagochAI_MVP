// src/types/hormone.ts
// Système hormonal — MVP COMPLET

// ============================================================
// TYPES D'HORMONES
// ============================================================
export type HormoneType =
  | 'dopamine'      // Plaisir, récompense, motivation
  | 'serotonin'     // Bien-être, stabilité, sérénité
  | 'oxytocin'      // Attachement, confiance, lien social
  | 'cortisol'      // Stress, peur, urgence
  | 'adrenaline'    // Excitation, énergie, alerte
  | 'endorphins';   // Confort, rire, soulagement

// ============================================================
// NIVEAUX (0-100 pour chaque hormone)
// ============================================================
export interface HormoneLevels {
  dopamine: number;
  serotonin: number;
  oxytocin: number;
  cortisol: number;
  adrenaline: number;
  endorphins: number;
}

// ============================================================
// MODIFICATEUR (événement qui change une hormone)
// ============================================================
export interface HormoneModifier {
  hormone: HormoneType;
  delta: number;          // +/- combien
  source: string;         // D'où ça vient (message, batterie, etc.)
  duration?: number;      // Durée de l'effet en ms (optionnel)
}

// ============================================================
// MODIFICATEURS PRÉDÉFINIS
// ============================================================
export type PredefinedModifier =
  | 'user_message'        // L'humain envoie un message
  | 'user_compliment'     // L'humain fait un compliment
  | 'user_insult'         // L'humain est méchant
  | 'user_return'         // L'humain revient après absence
  | 'long_absence'        // Longue absence de l'humain
  | 'battery_low'         // Batterie faible
  | 'battery_critical'    // Batterie critique
  | 'battery_charging'    // Branchement chargeur
  | 'battery_full'        // Batterie pleine
  | 'new_memory'          // Nouveau souvenir créé
  | 'evolution_up'        // Changement de stade
  | 'deep_conversation'   // Conversation profonde
  | 'humor_shared'        // Moment drôle partagé
  | 'night_time'          // Il fait nuit
  | 'morning_greeting';   // Premier message du matin

// ============================================================
// CONFIGURATION D'UNE HORMONE
// ============================================================
export interface HormoneConfig {
  type: HormoneType;
  baseline: number;       // Niveau de repos (retour naturel)
  min: number;            // Minimum possible
  max: number;            // Maximum possible
  halfLife: number;       // Demi-vie en minutes (vitesse de retour au baseline)
  description: string;    // Description lisible
}

// ============================================================
// SNAPSHOT (état complet à un instant T)
// ============================================================
export interface HormoneSnapshot {
  levels: HormoneLevels;
  dominantHormone: HormoneType;
  mood: string;
  timestamp: string;
}

// ============================================================
// HISTORIQUE
// ============================================================
export interface HormoneHistoryEntry {
  id: string;
  levels: HormoneLevels;
  triggerEvent: string;
  recordedAt: string;
}
