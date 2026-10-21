import type { StorageAdapter } from '../core';

const KEY = 'finanz-cockpit/finanzen.json';

/** Fallback für die Entwicklung im Browser (ohne Tauri). */
export const browserStorage: StorageAdapter = {
  beschreibung: 'Browser-Speicher (nur Entwicklung)',
  async load() {
    return localStorage.getItem(KEY);
  },
  async save(text) {
    localStorage.setItem(KEY, text);
  },
};
