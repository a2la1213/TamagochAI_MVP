// src/types/sensor.ts
// Capteurs du smartphone — MVP COMPLET

// ============================================================
// BATTERIE
// ============================================================
export type BatteryState = 'charging' | 'unplugged' | 'full' | 'unknown';

export interface BatteryInfo {
  level: number;            // 0-1 (pourcentage / 100)
  state: BatteryState;
  isLowPowerMode: boolean;
}

// ============================================================
// HEURE
// ============================================================
export type TimeOfDay =
  | 'night'       // 00:00 - 05:59
  | 'morning'     // 06:00 - 11:59
  | 'afternoon'   // 12:00 - 17:59
  | 'evening';    // 18:00 - 23:59

// ============================================================
// RÉSEAU
// ============================================================
export type NetworkState = 'online' | 'offline' | 'unknown';

// ============================================================
// CONTEXTE COMPLET DES CAPTEURS
// ============================================================
export interface SensorContext {
  battery: BatteryInfo;
  timeOfDay: TimeOfDay;
  currentHour: number;
  network: NetworkState;
  lastUpdated: string;
}

// ============================================================
// ÉVÉNEMENTS CAPTEURS
// ============================================================
export type SensorEvent =
  | { type: 'battery_low'; level: number }
  | { type: 'battery_critical'; level: number }
  | { type: 'battery_charging' }
  | { type: 'battery_full' }
  | { type: 'network_lost' }
  | { type: 'network_restored' }
  | { type: 'time_morning' }
  | { type: 'time_night' };
