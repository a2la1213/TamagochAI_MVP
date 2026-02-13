// src/stores/useDebugStore.ts
// Store de debug — capture tous les logs pour affichage dans l'app

import { create } from 'zustand';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  tag: string;
  message: string;
}

interface DebugState {
  logs: LogEntry[];
  addLog: (level: 'info' | 'warn' | 'error', tag: string, message: string) => void;
  clearLogs: () => void;
}

let logId = 0;
const MAX_LOGS = 200;

export const useDebugStore = create<DebugState>((set) => ({
  logs: [],
  addLog: (level, tag, message) => {
    const entry: LogEntry = {
      id: logId++,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level,
      tag,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };
    set((state) => ({
      logs: [...state.logs.slice(-MAX_LOGS), entry],
    }));
  },
  clearLogs: () => set({ logs: [] }),
}));

// Fonction globale pour logger depuis n'importe où
export function debugLog(level: 'info' | 'warn' | 'error', tag: string, ...args: any[]) {
  const message = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  useDebugStore.getState().addLog(level, tag, message);
}
