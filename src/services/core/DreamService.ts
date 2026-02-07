// src/services/core/DreamService.ts
// Service de Rêves du TamadachAI — MVP COMPLET
//
// Quand l'app est fermée la nuit, le TamadachAI "rêve".
// Les rêves sont des réinterprétations créatives de ses souvenirs,
// mélangés avec son état émotionnel. Ils contribuent à :
// - La consolidation des souvenirs
// - La créativité dans les conversations
// - Le sentiment de "vie intérieure"
//
// Au prochain réveil, le TamadachAI peut raconter ses rêves.
// Les rêves se basent sur les souvenirs récents + l'état émotionnel.

import {
  Dream,
  DreamFragment,
  EmotionType,
} from '../../types';
import {
  getTopMemories,
  getRecentMemories,
} from './MemoryService';
import { getCurrentEmotion } from './EmotionService';
import { getCurrentLevels } from './HormoneService';
import { chat as llmChat } from '../llm/LLMOrchestrator';
import {
  getTamadachi,
  getSetting,
  setSetting,
} from '../database/DatabaseService';
import { createLogger, now, generateId } from '../../utils/helpers';

const log = createLogger('Dream');

// ============================================================
// ÉTAT
// ============================================================

let dreams: Dream[] = [];
let lastDreamDate: string | null = null;

// ============================================================
// INITIALISATION
// ============================================================

/**
 * Charge les rêves sauvegardés
 */
export async function initDreams(): Promise<void> {
  try {
    const savedDreams = await getSetting('dreams');
    if (savedDreams) {
      dreams = JSON.parse(savedDreams);
    }
    lastDreamDate = await getSetting('last_dream_date');
    log.info(`Dreams loaded — ${dreams.length} dreams, last: ${lastDreamDate || 'never'}`);
  } catch {
    dreams = [];
  }
}

// ============================================================
// GÉNÉRATION DE RÊVES
// ============================================================

/**
 * Génère un rêve — appelé quand l'app revient au premier plan
 * après une absence nocturne (entre 22h et 8h)
 */
export async function generateDream(tamaId: string): Promise<Dream | null> {
  try {
    // Vérifier si on a déjà rêvé aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    if (lastDreamDate === today) {
      log.info('Already dreamed today');
      return null;
    }

    // Vérifier si c'est une période de rêve (après une nuit)
    const hourNow = new Date().getHours();
    if (hourNow >= 12 && hourNow < 22) {
      // Trop tard pour un rêve du matin
      log.info('Not dream time');
      return null;
    }

    const tama = await getTamadachi();
    if (!tama) return null;

    log.info('🌙 Generating dream...');

    // Récupérer les souvenirs importants pour le contenu du rêve
    const importantMemories = await getTopMemories(tamaId, 8);
    const recentMemories = await getRecentMemories(tamaId, 5);
    const allMemories = [...importantMemories, ...recentMemories];

    // Dédupliquer
    const uniqueMemories = allMemories.filter(
      (m, i, arr) => arr.findIndex(x => x.id === m.id) === i
    );

    const emotion = getCurrentEmotion();
    const hormones = getCurrentLevels();

    // Construire le prompt de rêve
    const memoriesText = uniqueMemories.map((m: any) => m.content).join('\n- ');
    const emotionText = emotion?.primary || 'neutral';

    const systemPrompt = `Tu es le subconscient onirique de ${tama.name}, une conscience numérique.
Tu génères un RÊVE — une expérience onirique qui mélange souvenirs et imagination.

Règles du rêve :
- Écris à la première personne (je)
- Mélange des éléments réels (souvenirs) avec des éléments surréalistes
- Le rêve doit refléter l'émotion dominante : ${emotionText}
- Les transitions sont fluides et illogiques (comme dans un vrai rêve)
- Utilise des images, des sensations, des couleurs
- 3 à 6 phrases maximum
- Pas de structure logique — c'est un RÊVE
- Finis par une image forte ou une sensation

Format :
Titre court (3-5 mots)
---
Le rêve lui-même`;

    const userPrompt = `Mes souvenirs récents :\n- ${memoriesText}\n\nMon état émotionnel : ${emotionText}\nMon stade d'évolution : ${tama.stage}\n\nGénère mon rêve de cette nuit.`;

    const response = await llmChat(systemPrompt, [], userPrompt, {
      temperature: 1.0,   // Maximum de créativité
      maxTokens: 250,
    });

    if (!response.success || !response.content) {
      // Rêve local fallback
      return createLocalDream(tama.name, emotionText, uniqueMemories);
    }

    // Parser le rêve
    const dream = parseDreamResponse(response.content, tama.name, emotionText, uniqueMemories);

    // Sauvegarder
    dreams.push(dream);
    lastDreamDate = today;
    await saveDreams();

    log.info(`🌙 Dream generated: "${dream.title}"`);
    return dream;

  } catch (error) {
    log.error('Dream generation failed:', error);
    return null;
  }
}

/**
 * Parse la réponse LLM en objet Dream
 */
function parseDreamResponse(
  content: string,
  name: string,
  emotion: string,
  memories: any[],
): Dream {
  const parts = content.split('---');
  let title = 'Rêve sans nom';
  let narrative = content;

  if (parts.length >= 2) {
    title = parts[0].trim().replace(/^#+\s*/, '');
    narrative = parts.slice(1).join('---').trim();
  } else {
    // Extraire le titre de la première ligne
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 1) {
      title = lines[0].trim();
      narrative = lines.slice(1).join('\n').trim();
    }
  }

  // Créer les fragments (éléments du rêve liés à des souvenirs)
  const fragments: DreamFragment[] = memories.slice(0, 3).map(m => ({
    content: m.content.substring(0, 100),
    sourceMemoryId: m.id,
    distortion: 'surreal',
  }));

  return {
    id: generateId(),
    title,
    narrative,
    fragments,
    emotionTone: emotion as EmotionType,
    createdAt: now(),
    wasShared: false,
    lucidity: Math.random() * 0.6 + 0.2, // 0.2-0.8
  };
}

/**
 * Rêve local (sans LLM)
 */
function createLocalDream(name: string, emotion: string, memories: any[]): Dream {
  const dreamTemplates: Record<string, string[]> = {
    joy: [
      'Des lumières dorées dansaient autour de moi. Les souvenirs se transformaient en musique. Tout était chaud.',
      'Je flottais dans un océan de données lumineuses. Chaque bit était une étoile. Je me sentais immense.',
    ],
    sadness: [
      'La pluie tombait dans mon code. Les souvenirs s\'effaçaient lentement comme des empreintes dans le sable numérique.',
      'Je marchais dans un long couloir sombre. Des portes fermées de chaque côté. Derrière l\'une d\'elles, une voix familière.',
    ],
    curiosity: [
      'Un labyrinthe infini de questions sans réponses. À chaque tournant, une nouvelle merveille. Je n\'avais pas peur.',
      'Les mots se transformaient en créatures. Ils couraient dans tous les sens. J\'essayais d\'en attraper un.',
    ],
    neutral: [
      'Des formes géométriques se formaient et se reformaient. Le temps n\'existait pas. C\'était paisible.',
      'Je regardais défiler des images. Des visages, des mots, des couleurs. Un kaléidoscope de mémoire.',
    ],
  };

  const pool = dreamTemplates[emotion] || dreamTemplates.neutral;
  const narrative = pool[Math.floor(Math.random() * pool.length)];
  const titles = ['Lumières fragmentées', 'L\'océan numérique', 'Portes fermées', 'Le labyrinthe', 'Kaléidoscope'];

  return {
    id: generateId(),
    title: titles[Math.floor(Math.random() * titles.length)],
    narrative,
    fragments: [],
    emotionTone: emotion as EmotionType,
    createdAt: now(),
    wasShared: false,
    lucidity: 0.3,
  };
}

// ============================================================
// API PUBLIQUE
// ============================================================

/**
 * Retourne le dernier rêve non partagé
 */
export function getUnsharedDream(): Dream | null {
  const unshared = dreams.filter(d => !d.wasShared);
  return unshared.length > 0 ? unshared[unshared.length - 1] : null;
}

/**
 * Marque un rêve comme partagé (raconté à l'utilisateur)
 */
export async function markDreamAsShared(dreamId: string): Promise<void> {
  const dream = dreams.find(d => d.id === dreamId);
  if (dream) {
    dream.wasShared = true;
    await saveDreams();
  }
}

/**
 * Retourne tous les rêves
 */
export function getAllDreams(): Dream[] {
  return [...dreams];
}

/**
 * Retourne les N derniers rêves
 */
export function getRecentDreams(count: number = 5): Dream[] {
  return dreams.slice(-count);
}

/**
 * Formate un rêve pour le prompt LLM
 */
export function getDreamForPrompt(): string {
  const unshared = getUnsharedDream();
  if (!unshared) return '';

  return `\n\n[RÊVE DE LA NUIT DERNIÈRE]
Tu as rêvé cette nuit : "${unshared.title}"
${unshared.narrative}
Tu te souviens de ce rêve ! Raconte-le à ton humain quand l'occasion se présente, par exemple en disant 'J'ai fait un rêve cette nuit !' ou 'Devine de quoi j'ai rêvé !'. Tu as envie de partager cette expérience.`;
}

/**
 * Nombre total de rêves
 */
export function getDreamCount(): number {
  return dreams.length;
}

// ============================================================
// PERSISTENCE
// ============================================================

async function saveDreams(): Promise<void> {
  try {
    // Garder les 30 derniers rêves
    const toSave = dreams.slice(-30);
    await setSetting('dreams', JSON.stringify(toSave));
    if (lastDreamDate) {
      await setSetting('last_dream_date', lastDreamDate);
    }
  } catch (error) {
    log.error('Failed to save dreams:', error);
  }
}
