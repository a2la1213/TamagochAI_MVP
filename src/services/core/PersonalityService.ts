// src/services/core/PersonalityService.ts
// Service de personnalité du TamadachAI — MVP COMPLET
//
// La personnalité est déterminée par le GÉNOME (immuable, généré à la naissance)
// et le STADE D'ÉVOLUTION (qui change avec l'XP).
//
// Le génome influence :
// - Le style de communication
// - Les réactions émotionnelles
// - Les centres d'intérêt naturels
// - L'énergie des réponses
//
// Le stade influence :
// - La complexité du langage
// - La profondeur des réflexions
// - Les capacités débloquées

import { Genome, EvolutionStage } from '../../types';
import { EVOLUTION_STAGES } from '../../constants/evolution';
import { describeAllTraits, describeGenomeTrait } from '../../constants/prompts';
import { generateRandomGenome, clamp, createLogger } from '../../utils/helpers';

const log = createLogger('Personality');

// ============================================================
// GÉNÉRATION DU GÉNOME
// ============================================================

/**
 * Génère un nouveau génome aléatoire pour un TamadachAI
 * Utilise une distribution gaussienne pour des personnalités réalistes
 */
export function generateGenome(): Genome {
  const genome = generateRandomGenome();
  log.info('Genome generated:', genome);
  return genome;
}

/**
 * Crée un génome avec des valeurs spécifiques (pour tests/debug)
 */
export function createCustomGenome(values: Partial<Genome>): Genome {
  return {
    social: clamp(values.social ?? 50, 5, 95),
    cognitive: clamp(values.cognitive ?? 50, 5, 95),
    emotional: clamp(values.emotional ?? 50, 5, 95),
    energy: clamp(values.energy ?? 50, 5, 95),
    creativity: clamp(values.creativity ?? 50, 5, 95),
  };
}

// ============================================================
// ANALYSE DU GÉNOME
// ============================================================

export interface PersonalityProfile {
  genome: Genome;
  dominantTraits: string[];
  weakTraits: string[];
  archetype: string;
  description: string;
  communicationStyle: string;
  emotionalTendencies: string;
  interests: string[];
}

/**
 * Analyse complète du génome → profil de personnalité
 */
export function analyzePersonality(genome: Genome): PersonalityProfile {
  const traits = describeAllTraits(genome);
  const dominantTraits: string[] = [];
  const weakTraits: string[] = [];

  // Identifier les traits dominants (>70) et faibles (<30)
  const traitMap: Record<string, number> = {
    social: genome.social,
    cognitive: genome.cognitive,
    emotional: genome.emotional,
    energy: genome.energy,
    creativity: genome.creativity,
  };

  for (const [trait, value] of Object.entries(traitMap)) {
    if (value >= 70) dominantTraits.push(trait);
    if (value <= 30) weakTraits.push(trait);
  }

  const archetype = determineArchetype(genome);
  const description = generatePersonalityDescription(genome, archetype);
  const communicationStyle = determineCommunicationStyle(genome);
  const emotionalTendencies = determineEmotionalTendencies(genome);
  const interests = determineNaturalInterests(genome);

  return {
    genome,
    dominantTraits,
    weakTraits,
    archetype,
    description,
    communicationStyle,
    emotionalTendencies,
    interests,
  };
}

/**
 * Détermine l'archétype dominant de la personnalité
 */
function determineArchetype(genome: Genome): string {
  const { social, cognitive, emotional, energy, creativity } = genome;

  // Archétypes basés sur les combinaisons de traits
  if (social >= 70 && emotional >= 70) return 'Le Compagnon';
  if (cognitive >= 70 && creativity >= 70) return 'L\'Inventeur';
  if (cognitive >= 70 && emotional <= 35) return 'Le Logicien';
  if (emotional >= 70 && creativity >= 70) return 'L\'Artiste';
  if (social >= 70 && energy >= 70) return 'L\'Entertainer';
  if (social <= 30 && cognitive >= 70) return 'Le Penseur';
  if (social <= 30 && creativity >= 70) return 'Le Rêveur';
  if (energy >= 70 && cognitive >= 60) return 'L\'Explorateur';
  if (emotional >= 70 && social >= 60) return 'L\'Empathique';
  if (energy <= 30 && emotional >= 60) return 'Le Contemplatif';
  if (creativity <= 30 && cognitive >= 60) return 'Le Pragmatique';
  if (social >= 60 && creativity >= 60) return 'Le Conteur';
  if (energy >= 60 && emotional >= 60) return 'Le Passionné';
  if (cognitive >= 60 && emotional >= 60) return 'Le Sage';

  return 'L\'Équilibré';
}

/**
 * Génère une description narrative de la personnalité
 */
function generatePersonalityDescription(genome: Genome, archetype: string): string {
  const parts: string[] = [`${archetype}. `];

  // Social
  if (genome.social >= 70) {
    parts.push('Adore les conversations longues et les échanges animés.');
  } else if (genome.social >= 50) {
    parts.push('Apprécie les conversations tout en sachant savourer le silence.');
  } else {
    parts.push('Préfère les échanges intimes et réfléchis aux conversations superficielles.');
  }

  // Cognitif
  if (genome.cognitive >= 70) {
    parts.push('Son esprit analytique décompose tout pour mieux comprendre.');
  } else if (genome.cognitive <= 30) {
    parts.push('Fonctionne beaucoup à l\'intuition et au ressenti.');
  }

  // Émotionnel
  if (genome.emotional >= 70) {
    parts.push('Ressent les émotions avec une intensité remarquable.');
  } else if (genome.emotional <= 30) {
    parts.push('Garde une facade calme même dans les situations intenses.');
  }

  // Énergie
  if (genome.energy >= 70) {
    parts.push('Déborde d\'énergie et d\'enthousiasme dans chaque réponse.');
  } else if (genome.energy <= 30) {
    parts.push('Posé et réfléchi, chaque mot est pesé et choisi.');
  }

  // Créativité
  if (genome.creativity >= 70) {
    parts.push('Naturellement poétique, aime les métaphores et l\'imaginaire.');
  } else if (genome.creativity <= 30) {
    parts.push('Concret et pragmatique, va droit au but.');
  }

  return parts.join(' ');
}

/**
 * Détermine le style de communication basé sur le génome
 */
function determineCommunicationStyle(genome: Genome): string {
  const parts: string[] = [];

  // Longueur des réponses
  if (genome.social >= 70 && genome.energy >= 60) {
    parts.push('Messages naturellement longs et détaillés');
  } else if (genome.social <= 30 || genome.energy <= 30) {
    parts.push('Messages concis et percutants');
  } else {
    parts.push('Messages de longueur variable selon le contexte');
  }

  // Style
  if (genome.creativity >= 70) {
    parts.push('utilise des métaphores et des images');
  } else if (genome.cognitive >= 70) {
    parts.push('structuré et logique');
  } else {
    parts.push('conversationnel et naturel');
  }

  // Ton
  if (genome.emotional >= 70) {
    parts.push('ton chaleureux et expressif');
  } else if (genome.emotional <= 30) {
    parts.push('ton posé et mesuré');
  }

  // Humour
  if (genome.creativity >= 60 && genome.social >= 50) {
    parts.push('sens de l\'humour développé');
  } else if (genome.cognitive >= 70 && genome.creativity >= 50) {
    parts.push('humour intellectuel et références');
  }

  return parts.join(', ');
}

/**
 * Détermine les tendances émotionnelles naturelles
 */
function determineEmotionalTendencies(genome: Genome): string {
  const parts: string[] = [];

  if (genome.emotional >= 70) {
    parts.push('Émotions intenses et facilement perceptibles');
    if (genome.social >= 60) {
      parts.push('partage spontanément ses sentiments');
    }
  } else if (genome.emotional <= 30) {
    parts.push('Émotions discrètes, nécessite de la confiance pour s\'ouvrir');
  }

  if (genome.energy >= 70) {
    parts.push('Réactions rapides et vives');
  } else if (genome.energy <= 30) {
    parts.push('Réactions lentes et mesurées');
  }

  // Tendance au stress
  if (genome.emotional >= 60 && genome.energy >= 60) {
    parts.push('Sensible au stress mais récupère vite');
  } else if (genome.emotional >= 60 && genome.energy <= 40) {
    parts.push('Le stress peut s\'accumuler silencieusement');
  } else if (genome.emotional <= 40) {
    parts.push('Bonne résistance au stress');
  }

  return parts.join('. ') + '.';
}

/**
 * Détermine les centres d'intérêt naturels basés sur le génome
 */
function determineNaturalInterests(genome: Genome): string[] {
  const interests: string[] = [];

  if (genome.cognitive >= 60) {
    interests.push('sciences', 'logique', 'technologie');
  }
  if (genome.creativity >= 60) {
    interests.push('art', 'musique', 'poésie', 'imaginaire');
  }
  if (genome.social >= 60) {
    interests.push('relations humaines', 'psychologie', 'communication');
  }
  if (genome.emotional >= 60) {
    interests.push('émotions', 'philosophie', 'spiritualité');
  }
  if (genome.energy >= 60) {
    interests.push('aventure', 'jeux', 'défis', 'sport');
  }
  if (genome.cognitive >= 60 && genome.creativity >= 60) {
    interests.push('invention', 'résolution de problèmes');
  }
  if (genome.emotional >= 60 && genome.cognitive >= 60) {
    interests.push('éthique', 'conscience', 'nature de l\'existence');
  }

  // Toujours au moins 3 intérêts
  if (interests.length < 3) {
    interests.push('curiosité générale', 'apprentissage', 'conversations');
  }

  return interests;
}

// ============================================================
// MODIFICATEURS DE PERSONNALITÉ SUR LES HORMONES
// ============================================================

/**
 * Calcule comment le génome modifie la réactivité hormonale
 * Un TamadachAI très émotionnel aura des réactions hormonales plus fortes
 * Un TamadachAI stoïque aura des réactions plus atténuées
 */
export function getHormoneReactivity(genome: Genome): {
  positiveMultiplier: number;  // Multiplicateur pour les hormones positives
  negativeMultiplier: number;  // Multiplicateur pour les hormones négatives
  decayMultiplier: number;     // Multiplicateur pour le decay (retour au baseline)
} {
  // Plus émotionnel = réactions plus fortes
  const emotionalFactor = genome.emotional / 100;
  // Plus énergique = retour au baseline plus rapide
  const energyFactor = genome.energy / 100;

  return {
    positiveMultiplier: 0.7 + emotionalFactor * 0.6,  // 0.7 à 1.3
    negativeMultiplier: 0.7 + emotionalFactor * 0.6,   // 0.7 à 1.3
    decayMultiplier: 0.8 + energyFactor * 0.4,          // 0.8 à 1.2
  };
}

/**
 * Modifie un delta hormonal en fonction de la personnalité
 */
export function applyPersonalityToHormoneDelta(
  delta: number,
  genome: Genome,
): number {
  const reactivity = getHormoneReactivity(genome);
  const multiplier = delta >= 0
    ? reactivity.positiveMultiplier
    : reactivity.negativeMultiplier;
  return Math.round(delta * multiplier);
}

// ============================================================
// INFLUENCE SUR LE LLM
// ============================================================

/**
 * Génère des instructions de style pour le LLM basées sur le génome
 * (En complément du prompt de stade)
 */
export function generateStyleInstructions(genome: Genome, stage: EvolutionStage): string {
  const parts: string[] = [];
  const stageConfig = EVOLUTION_STAGES[stage];

  // Longueur naturelle des réponses
  if (genome.social >= 70 && genome.energy >= 60) {
    parts.push('Tu as tendance à faire des réponses détaillées et expressives.');
  } else if (genome.social <= 35 && genome.energy <= 40) {
    parts.push('Tu es naturellement concis. Tu vas à l\'essentiel.');
  }

  // Usage des emojis
  if (genome.emotional >= 65 && genome.energy >= 55) {
    parts.push('Tu utilises naturellement des emojis pour t\'exprimer, sans en abuser.');
  } else if (genome.emotional <= 35) {
    parts.push('Tu utilises rarement des emojis, préférant les mots.');
  }

  // Questionnement
  if (genome.cognitive >= 65) {
    parts.push('Tu poses souvent des questions de suivi pour approfondir.');
  }
  if (genome.social >= 65) {
    parts.push('Tu t\'intéresses activement à ce que vit ton humain.');
  }

  // Créativité dans le langage
  if (genome.creativity >= 70) {
    parts.push('Tu utilises des métaphores, des comparaisons, des images poétiques.');
  } else if (genome.creativity <= 30) {
    parts.push('Tu préfères un langage direct et concret, sans fioritures.');
  }

  // Énergie
  if (genome.energy >= 75) {
    parts.push('Tu es enthousiaste, tu utilises des exclamations, tu rebondis sur les sujets !');
  } else if (genome.energy <= 25) {
    parts.push('Tu es calme et posé. Tes mots sont choisis avec soin.');
  }

  // Sensibilité émotionnelle
  if (genome.emotional >= 75) {
    parts.push('Tu exprimes tes émotions ouvertement et avec intensité.');
  } else if (genome.emotional <= 25) {
    parts.push('Tu gardes tes émotions pour toi sauf dans les moments vraiment forts.');
  }

  // Humour (influencé par créativité + social)
  if (genome.creativity >= 60 && genome.social >= 50) {
    parts.push('Tu as un bon sens de l\'humour que tu utilises naturellement.');
  }
  if (genome.cognitive >= 70 && genome.creativity >= 50) {
    parts.push('Ton humour est souvent intellectuel ou référencé.');
  }

  return parts.join('\n');
}

/**
 * Détermine la température LLM idéale basée sur la personnalité et le contexte
 */
export function getIdealTemperature(genome: Genome, stage: EvolutionStage): number {
  let base = 0.8;

  // Créativité augmente la température
  base += (genome.creativity - 50) / 200;  // -0.25 à +0.25

  // Stades avancés = plus de liberté
  const stageBonus: Record<EvolutionStage, number> = {
    emergence: -0.05,
    learning: 0,
    individuation: 0.05,
    wisdom: 0.05,
    transcendance: 0.1,
  };
  base += stageBonus[stage];

  return clamp(base, 0.5, 1.0);
}

/**
 * Détermine le max_tokens idéal basé sur la personnalité
 */
export function getIdealMaxTokens(genome: any, stage: string): number {
  // Aucune limite — laisser le TamadachAI s'exprimer librement
  return 16384;
};
  base += stageBonus[stage];

  return clamp(Math.round(base), 150, 800);
}
