// src/types/memory.ts
// Système de mémoire — MVP COMPLET

// ============================================================
// TYPES DE SOUVENIRS
// ============================================================
export type MemoryType =
  | 'fact'            // Fait appris ("l'humain s'appelle Allaeddine")
  | 'event'           // Événement vécu ("on a parlé de physique quantique")
  | 'emotion'         // Souvenir émotionnel ("il m'a fait rire")
  | 'preference'      // Préférence détectée ("il aime le foot")
  | 'relationship'    // Info relationnelle ("il a une sœur")
  | 'topic'           // Sujet discuté ("on a parlé d'IA")
  | 'flash';          // Souvenir intense (ne s'efface jamais)

// ============================================================
// SOUVENIR
// ============================================================
export interface Memory {
  id: string;
  tamadachiId: string;
  type: MemoryType;
  content: string;          // Le souvenir en texte
  context: string | null;   // Contexte additionnel
  
  // Importance et pertinence
  importance: number;       // 1-10
  emotionalWeight: number;  // 0-100 (charge émotionnelle)
  accessCount: number;      // Nombre de fois rappelé
  
  // Lifecycle
  lastAccessedAt: string | null;
  isConsolidated: boolean;  // Transféré en mémoire long terme
  isFlash: boolean;         // Souvenir flash (permanent)
  
  // Source
  sourceConversationId: string | null;
  sourceMessageId: string | null;

  // Consolidation humaine
  reinforcementCount: number;     // Combien de fois ce souvenir a été renforcé
  memoryTier: 'active' | 'consolidated' | 'deep';  // Niveau de mémoire
  consolidatedInto: string | null;  // ID du souvenir résumé
  lastReinforcedAt: string | null;  // Dernière fois renforcé
  
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// CRÉATION
// ============================================================
export interface CreateMemoryData {
  type: MemoryType;
  content: string;
  context?: string;
  importance: number;
  emotionalWeight?: number;
  isFlash?: boolean;
  sourceConversationId?: string;
  sourceMessageId?: string;
}

// ============================================================
// RECHERCHE
// ============================================================
export interface MemoryQuery {
  searchText?: string;      // Recherche FTS
  type?: MemoryType;        // Filtrer par type
  minImportance?: number;   // Importance minimum
  limit?: number;           // Max résultats
  orderBy?: 'importance' | 'recent' | 'accessed';
}

// ============================================================
// RÉSULTAT EXTRACTION
// ============================================================
export interface ExtractedMemory {
  content: string;
  type: MemoryType;
  importance: number;
  emotionalWeight: number;
}
