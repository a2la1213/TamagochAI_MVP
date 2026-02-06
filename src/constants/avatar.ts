// src/constants/avatar.ts
// Système d'avatar du TamadachAI — MVP COMPLET
//
// L'avatar est la représentation visuelle du TamadachAI.
// Il a un type (robot, humanoïde, etc.), un style, une couleur,
// et des expressions qui changent selon l'émotion.
//
// MVP : Expressions statiques (images qui changent).
// V2 : Animations, morphing, particules.

import {
  AvatarType,
  AvatarStyle,
  AvatarExpression,
  AvatarConfig,
} from '../types/tamadachi';

// ============================================================
// CONFIGURATION DES TYPES D'AVATAR
// ============================================================

export interface AvatarTypeConfig {
  type: AvatarType;
  name: string;
  emoji: string;
  description: string;
  personalities: string[];  // Traits de personnalité qui matchent bien
}

export const AVATAR_TYPES: Record<AvatarType, AvatarTypeConfig> = {
  robot: {
    type: 'robot',
    name: 'Robot',
    emoji: '🤖',
    description: 'Un robot amical avec des yeux expressifs',
    personalities: ['analytique', 'pragmatique', 'méthodique'],
  },
  humanoid: {
    type: 'humanoid',
    name: 'Humanoïde',
    emoji: '🧑',
    description: 'Un visage doux aux traits simplifiés',
    personalities: ['empathique', 'social', 'expressif'],
  },
  creature: {
    type: 'creature',
    name: 'Créature',
    emoji: '🐲',
    description: 'Une petite créature fantastique adorable',
    personalities: ['curieux', 'joueur', 'aventurier'],
  },
  spirit: {
    type: 'spirit',
    name: 'Esprit',
    emoji: '👻',
    description: 'Un esprit lumineux et éthéré',
    personalities: ['mystérieux', 'profond', 'contemplatif'],
  },
  animal: {
    type: 'animal',
    name: 'Animal',
    emoji: '🦊',
    description: 'Un compagnon animal stylisé',
    personalities: ['loyal', 'affectueux', 'protecteur'],
  },
  abstract: {
    type: 'abstract',
    name: 'Abstrait',
    emoji: '✨',
    description: 'Une forme géométrique vivante et colorée',
    personalities: ['créatif', 'unique', 'original'],
  },
};

// ============================================================
// STYLES
// ============================================================

export interface AvatarStyleConfig {
  style: AvatarStyle;
  name: string;
  description: string;
}

export const AVATAR_STYLES: Record<AvatarStyle, AvatarStyleConfig> = {
  feminine: {
    style: 'feminine',
    name: 'Féminin',
    description: 'Traits doux et arrondis',
  },
  masculine: {
    style: 'masculine',
    name: 'Masculin',
    description: 'Traits anguleux et définis',
  },
  neutral: {
    style: 'neutral',
    name: 'Neutre',
    description: 'Traits équilibrés et universels',
  },
};

// ============================================================
// COULEURS DISPONIBLES
// ============================================================

export interface AvatarColorConfig {
  id: string;
  name: string;
  hex: string;
  gradient?: [string, string];  // Pour un dégradé (V2)
}

export const AVATAR_COLORS: AvatarColorConfig[] = [
  { id: 'blue', name: 'Bleu', hex: '#3B82F6', gradient: ['#3B82F6', '#1D4ED8'] },
  { id: 'purple', name: 'Violet', hex: '#8B5CF6', gradient: ['#8B5CF6', '#6D28D9'] },
  { id: 'pink', name: 'Rose', hex: '#EC4899', gradient: ['#EC4899', '#BE185D'] },
  { id: 'red', name: 'Rouge', hex: '#EF4444', gradient: ['#EF4444', '#B91C1C'] },
  { id: 'orange', name: 'Orange', hex: '#F97316', gradient: ['#F97316', '#C2410C'] },
  { id: 'yellow', name: 'Jaune', hex: '#F59E0B', gradient: ['#F59E0B', '#B45309'] },
  { id: 'green', name: 'Vert', hex: '#10B981', gradient: ['#10B981', '#047857'] },
  { id: 'teal', name: 'Turquoise', hex: '#14B8A6', gradient: ['#14B8A6', '#0F766E'] },
  { id: 'cyan', name: 'Cyan', hex: '#06B6D4', gradient: ['#06B6D4', '#0E7490'] },
  { id: 'white', name: 'Blanc', hex: '#F9FAFB', gradient: ['#F9FAFB', '#E5E7EB'] },
];

// ============================================================
// EXPRESSIONS
// ============================================================

export interface ExpressionConfig {
  expression: AvatarExpression;
  name: string;
  emoji: string;
  description: string;
  eyes: string;       // Description pour génération d'assets
  mouth: string;      // Description pour génération d'assets
  extras: string;     // Détails supplémentaires
}

export const AVATAR_EXPRESSIONS: Record<AvatarExpression, ExpressionConfig> = {
  neutral: {
    expression: 'neutral',
    name: 'Neutre',
    emoji: '😐',
    description: 'Expression calme et détendue',
    eyes: 'Ouverts normalement, regard droit',
    mouth: 'Ligne droite ou léger sourire',
    extras: 'Posture détendue',
  },
  happy: {
    expression: 'happy',
    name: 'Heureux',
    emoji: '😊',
    description: 'Grand sourire, yeux brillants',
    eyes: 'Légèrement plissés, brillants, pétillants',
    mouth: 'Grand sourire ouvert',
    extras: 'Légère inclinaison de la tête, joues roses',
  },
  sad: {
    expression: 'sad',
    name: 'Triste',
    emoji: '😢',
    description: 'Regard vers le bas, moue',
    eyes: 'Tombants, légèrement humides',
    mouth: 'Moue, lèvres vers le bas',
    extras: 'Posture affaissée, une larme possible',
  },
  angry: {
    expression: 'angry',
    name: 'En colère',
    emoji: '😤',
    description: 'Sourcils froncés, expression intense',
    eyes: 'Plissés, sourcils froncés',
    mouth: 'Serrée, crispée',
    extras: 'Légère rougeur, posture tendue',
  },
  scared: {
    expression: 'scared',
    name: 'Effrayé',
    emoji: '😰',
    description: 'Yeux grands ouverts, expression inquiète',
    eyes: 'Très grands ouverts, pupilles dilatées',
    mouth: 'Ouverte en O, ou lèvres tremblantes',
    extras: 'Corps recroquevillé, sueur possible',
  },
  loving: {
    expression: 'loving',
    name: 'Amoureux',
    emoji: '🥰',
    description: 'Yeux en cœur, expression tendre',
    eyes: 'En forme de cœur ou très doux',
    mouth: 'Sourire tendre et doux',
    extras: 'Petits cœurs autour, joues très roses',
  },
};

// ============================================================
// CONFIG PAR DÉFAUT
// ============================================================

export const DEFAULT_AVATAR: AvatarConfig = {
  type: 'robot',
  style: 'neutral',
  color: '#3B82F6',
  currentExpression: 'neutral',
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Retourne la config d'expression pour une émotion donnée
 */
export function getExpressionForEmotion(emotionType: string): AvatarExpression {
  const emotionToExpression: Record<string, AvatarExpression> = {
    joy: 'happy',
    sadness: 'sad',
    anger: 'angry',
    fear: 'scared',
    love: 'loving',
    surprise: 'happy',
    curiosity: 'neutral',
    neutral: 'neutral',
  };
  return emotionToExpression[emotionType] || 'neutral';
}

/**
 * Retourne toutes les combinaisons possibles (pour le shop V2)
 * 6 types × 3 styles × 10 couleurs = 180 combinaisons
 */
export function getTotalCombinations(): number {
  return Object.keys(AVATAR_TYPES).length *
    Object.keys(AVATAR_STYLES).length *
    AVATAR_COLORS.length;
}

/**
 * Génère un avatar aléatoire
 */
export function generateRandomAvatar(): AvatarConfig {
  const types = Object.keys(AVATAR_TYPES) as AvatarType[];
  const styles = Object.keys(AVATAR_STYLES) as AvatarStyle[];
  const colors = AVATAR_COLORS;

  return {
    type: types[Math.floor(Math.random() * types.length)],
    style: styles[Math.floor(Math.random() * styles.length)],
    color: colors[Math.floor(Math.random() * colors.length)].hex,
    currentExpression: 'neutral',
  };
}

/**
 * Valide une config d'avatar
 */
export function validateAvatarConfig(config: Partial<AvatarConfig>): boolean {
  if (config.type && !AVATAR_TYPES[config.type]) return false;
  if (config.style && !AVATAR_STYLES[config.style]) return false;
  if (config.currentExpression && !AVATAR_EXPRESSIONS[config.currentExpression]) return false;
  if (config.color) {
    const validColor = AVATAR_COLORS.some(c => c.hex === config.color) ||
      /^#[0-9A-Fa-f]{6}$/.test(config.color);
    if (!validColor) return false;
  }
  return true;
}

/**
 * Retourne le chemin de l'asset d'expression
 * (pour le composant Avatar dans l'UI)
 */
export function getExpressionAssetPath(
  type: AvatarType,
  expression: AvatarExpression,
): string {
  return `assets/avatars/expressions/${type}_${expression}.png`;
}

/**
 * Retourne la description complète d'un avatar pour l'affichage
 */
export function describeAvatar(config: AvatarConfig): string {
  const typeConfig = AVATAR_TYPES[config.type];
  const styleConfig = AVATAR_STYLES[config.style];
  const colorConfig = AVATAR_COLORS.find(c => c.hex === config.color);

  const colorName = colorConfig?.name || 'personnalisé';
  return `${typeConfig.name} ${styleConfig.name.toLowerCase()} ${colorName.toLowerCase()}`;
}
