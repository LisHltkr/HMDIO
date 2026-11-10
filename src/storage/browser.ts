import type { StorageAdapter } from '../core';

const KEY = 'finanz-cockpit/finanzen.json';

/**
 * Speicher im Browser: die Web-App (z. B. vom iPhone-Home-Bildschirm) und die Entwicklung ohne Tauri.
 * Sicher vor Verlust wird er erst mit Export oder Sync (docs/entscheidungen/0004).
 */
export const browserStorage: StorageAdapter = {
  beschreibung: 'auf diesem Gerät (Browser-Speicher)',
  async load() {
    return localStorage.getItem(KEY);
  },
  async save(text) {
    localStorage.setItem(KEY, text);
  },
};
