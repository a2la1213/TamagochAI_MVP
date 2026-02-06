// src/utils/helpers.ts
// Fonctions utilitaires générales — MVP COMPLET
//
// Ce fichier contient TOUTES les fonctions utilitaires
// qui sont utilisées à travers toute l'application.
// Aucune dépendance externe ici — que du TypeScript pur.

import { TimeOfDay } from '../types';

// ============================================================
// GÉNÉRATION D'ID
// ============================================================

/**
 * Génère un UUID v4 simple
 * Compatible avec tous les environnements (pas besoin de crypto)
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Génère un ID court (8 caractères) pour les logs et debug
 */
export function generateShortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ============================================================
// DATES ET TEMPS
// ============================================================

/**
 * Retourne un timestamp ISO 8601
 */
export function now(): string {
  return new Date().toISOString();
}

/**
 * Calcule la différence en minutes entre deux dates ISO
 */
export function diffInMinutes(from: string, to: string): number {
  const diff = new Date(to).getTime() - new Date(from).getTime();
  return diff / (1000 * 60);
}

/**
 * Calcule la différence en heures entre deux dates ISO
 */
export function diffInHours(from: string, to: string): number {
  return diffInMinutes(from, to) / 60;
}

/**
 * Calcule la différence en jours entre deux dates ISO
 */
export function diffInDays(from: string, to: string): number {
  return diffInHours(from, to) / 24;
}

/**
 * Calcule la différence en secondes entre deux dates ISO
 */
export function diffInSeconds(from: string, to: string): number {
  return diffInMinutes(from, to) * 60;
}

/**
 * Retourne le nombre de jours depuis une date ISO
 */
export function daysSince(date: string): number {
  return Math.floor(diffInDays(date, now()));
}

/**
 * Retourne le moment de la journée
 */
export function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 6) return 'night';
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

/**
 * Retourne l'heure actuelle (0-23)
 */
export function getCurrentHour(): number {
  return new Date().getHours();
}

/**
 * Retourne une description en français du moment de la journée
 */
export function getTimeOfDayLabel(): string {
  const tod = getTimeOfDay();
  const labels: Record<TimeOfDay, string> = {
    night: 'nuit (00h-06h)',
    morning: 'matin (06h-12h)',
    afternoon: 'après-midi (12h-18h)',
    evening: 'soirée (18h-00h)',
  };
  return labels[tod];
}

/**
 * Retourne une salutation appropriée selon l'heure
 */
export function getGreeting(): string {
  const tod = getTimeOfDay();
  const greetings: Record<TimeOfDay, string> = {
    night: 'Bonne nuit',
    morning: 'Bonjour',
    afternoon: 'Bon après-midi',
    evening: 'Bonsoir',
  };
  return greetings[tod];
}

/**
 * Vérifie si une date ISO est aujourd'hui
 */
export function isToday(date: string): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
}

/**
 * Vérifie si une date ISO est hier
 */
export function isYesterday(date: string): boolean {
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
}

/**
 * Formate une date ISO en format relatif français
 */
export function formatRelativeDate(date: string): string {
  if (isToday(date)) return "Aujourd'hui";
  if (isYesterday(date)) return 'Hier';

  const days = Math.floor(daysSince(date));
  if (days < 7) return `Il y a ${days} jours`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `Il y a ${months} mois`;
  }
  const years = Math.floor(days / 365);
  return `Il y a ${years} an${years > 1 ? 's' : ''}`;
}

/**
 * Formate une date ISO en format court (HH:MM)
 */
export function formatTime(date: string): string {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Formate une date ISO en format long (DD/MM/YYYY HH:MM)
 */
export function formatDateTime(date: string): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  const time = formatTime(date);
  return `${day}/${month}/${year} ${time}`;
}

/**
 * Retourne le début de la journée en cours (00:00:00)
 */
export function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Retourne le début de l'heure en cours
 */
export function startOfCurrentHour(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

// ============================================================
// NOMBRES ET MATHÉMATIQUES
// ============================================================

/**
 * Clamp une valeur entre min et max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Arrondi à n décimales
 */
export function round(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Génère un nombre aléatoire entre min et max (inclus)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Génère un float aléatoire entre min et max
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Interpolation linéaire
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Map une valeur d'un range à un autre
 */
export function mapRange(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  const normalized = (value - fromMin) / (fromMax - fromMin);
  return lerp(toMin, toMax, normalized);
}

/**
 * Calcule un pourcentage
 */
export function percentage(value: number, total: number): number {
  if (total === 0) return 0;
  return round((value / total) * 100, 1);
}

// ============================================================
// CHAÎNES DE CARACTÈRES
// ============================================================

/**
 * Tronque un texte à une longueur max avec "..."
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Capitalise la première lettre
 */
export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Nettoie un texte (trim + espaces multiples)
 */
export function cleanText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Compte le nombre de mots dans un texte
 */
export function wordCount(text: string): number {
  return cleanText(text).split(' ').filter(w => w.length > 0).length;
}

/**
 * Vérifie si un texte est "substantiel" (pas juste "ok", "lol", etc.)
 */
export function isSubstantialMessage(text: string, minWords: number = 3): boolean {
  return wordCount(text) >= minWords;
}

/**
 * Extrait les mots-clés d'un texte (mots de plus de 3 lettres, sans doublons)
 */
export function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'mais',
    'donc', 'car', 'que', 'qui', 'dont', 'pour', 'dans', 'sur', 'avec',
    'par', 'pas', 'plus', 'est', 'son', 'ses', 'mon', 'mes', 'ton', 'tes',
    'nous', 'vous', 'ils', 'elle', 'elles', 'lui', 'leur', 'ce', 'cette',
    'ces', 'être', 'avoir', 'faire', 'dire', 'aller', 'voir', 'savoir',
    'pouvoir', 'falloir', 'vouloir', 'venir', 'aussi', 'bien', 'très',
    'tout', 'tous', 'toute', 'toutes', 'comme', 'quand', 'comment',
    'pourquoi', 'trop', 'peu', 'même', 'autre', 'autres', 'encore',
    'après', 'avant', 'entre', 'sans', 'sous', 'chez', 'vers', 'alors',
    'là', 'ici', 'oui', 'non', 'bon', 'bien', 'mal', 'tant', 'suis',
    'fait', 'dit', 'merci', 'bonjour', 'salut', 'juste', 'vraiment',
    'the', 'is', 'are', 'was', 'were', 'and', 'but', 'for', 'not',
    'you', 'all', 'can', 'had', 'her', 'his', 'one', 'our', 'out',
  ]);

  const words = cleanText(text.toLowerCase())
    .replace(/[^a-zàâäéèêëïîôùûüÿæœç\s]/g, '')
    .split(' ')
    .filter(w => w.length > 3 && !stopWords.has(w));

  return [...new Set(words)];
}

// ============================================================
// TABLEAUX
// ============================================================

/**
 * Mélange un tableau (Fisher-Yates shuffle)
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Prend N éléments aléatoires d'un tableau
 */
export function pickRandom<T>(array: T[], count: number = 1): T[] {
  return shuffle(array).slice(0, count);
}

/**
 * Groupe un tableau par une clé
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Retourne le dernier élément d'un tableau
 */
export function last<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

// ============================================================
// FORMATAGE POUR L'AFFICHAGE
// ============================================================

/**
 * Formate un nombre d'XP (1500 → "1.5k")
 */
export function formatXP(xp: number): string {
  if (xp < 1000) return xp.toString();
  if (xp < 10000) return (xp / 1000).toFixed(1) + 'k';
  return Math.floor(xp / 1000) + 'k';
}

/**
 * Formate un pourcentage de batterie (0.85 → "85%")
 */
export function formatBattery(level: number): string {
  return `${Math.round(level * 100)}%`;
}

/**
 * Formate un nombre de jours en durée lisible
 */
export function formatDuration(days: number): string {
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return '1 jour';
  if (days < 7) return `${days} jours`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} semaine${weeks > 1 ? 's' : ''}`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} mois`;
  }
  const years = Math.floor(days / 365);
  const remainingMonths = Math.floor((days % 365) / 30);
  if (remainingMonths === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} et ${remainingMonths} mois`;
}

/**
 * Formate un temps en ms en format lisible
 */
export function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Formate une taille de fichier en format lisible
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// ============================================================
// GÉNOME / PERSONNALITÉ
// ============================================================

/**
 * Génère un génome aléatoire avec des valeurs réalistes
 * Utilise une distribution normale plutôt qu'uniforme
 * pour que les extrêmes (0-20 et 80-100) soient plus rares
 */
export function generateRandomGenome(): {
  social: number;
  cognitive: number;
  emotional: number;
  energy: number;
  creativity: number;
} {
  const gaussianRandom = (): number => {
    // Box-Muller transform pour distribution normale
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const normal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    // Centrer sur 50, écart-type de 20, borner entre 5 et 95
    return clamp(Math.round(50 + normal * 20), 5, 95);
  };

  return {
    social: gaussianRandom(),
    cognitive: gaussianRandom(),
    emotional: gaussianRandom(),
    energy: gaussianRandom(),
    creativity: gaussianRandom(),
  };
}

// ============================================================
// VALIDATION
// ============================================================

/**
 * Vérifie si une chaîne est un UUID valide
 */
export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Vérifie si une chaîne est une date ISO valide
 */
export function isValidISO(str: string): boolean {
  const d = new Date(str);
  return !isNaN(d.getTime());
}

/**
 * Vérifie si une chaîne ressemble à une clé API
 */
export function isValidAPIKey(key: string): boolean {
  return key.length >= 10 && /^[a-zA-Z0-9_-]+$/.test(key);
}

// ============================================================
// ASYNC HELPERS
// ============================================================

/**
 * Attend un certain nombre de millisecondes
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry une fonction async avec backoff exponentiel
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Debounce une fonction
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle une fonction
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================================
// LOGGING
// ============================================================

const LOG_ENABLED = __DEV__ ?? true;

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Logger centralisé avec préfixe par module
 */
export function createLogger(module: string) {
  const log = (level: LogLevel, ...args: any[]) => {
    if (!LOG_ENABLED && level !== 'error') return;
    const prefix = `[${module}]`;
    switch (level) {
      case 'info': console.log(prefix, ...args); break;
      case 'warn': console.warn(prefix, ...args); break;
      case 'error': console.error(prefix, ...args); break;
      case 'debug': console.log(`${prefix} [DEBUG]`, ...args); break;
    }
  };

  return {
    info: (...args: any[]) => log('info', ...args),
    warn: (...args: any[]) => log('warn', ...args),
    error: (...args: any[]) => log('error', ...args),
    debug: (...args: any[]) => log('debug', ...args),
  };
}
