import type { StorageAdapter } from '../core';
import { browserStorage } from './browser';

export function laeuftInTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Wählt die Datei im App-Datenordner (Desktop) oder den Browser-Speicher (Entwicklung). */
export async function createStorage(): Promise<StorageAdapter> {
  if (!laeuftInTauri()) return browserStorage;
  const { createTauriFileStorage } = await import('./tauriFile');
  return createTauriFileStorage();
}
