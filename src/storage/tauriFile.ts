import { appDataDir, join } from '@tauri-apps/api/path';
import { BaseDirectory, copyFile, exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import type { StorageAdapter } from '../core';

const DATEI = 'finanzen.json';
const TEMP = 'finanzen.json.tmp';
const BACKUP_ORDNER = 'backups';
const MAX_BACKUPS = 10;
const opts = { baseDir: BaseDirectory.AppData };

/**
 * Speichert alles in einer JSON-Datei im App-Datenordner.
 * - Schreiben über eine temporäre Datei + Umbenennen, damit nie eine halbe Datei entsteht.
 * - Vor dem ersten Speichern je Programmstart wird eine Sicherung angelegt (die letzten 10 bleiben).
 */
export async function createTauriFileStorage(): Promise<StorageAdapter> {
  await mkdir(BACKUP_ORDNER, { ...opts, recursive: true });
  const pfad = await join(await appDataDir(), DATEI);
  let gesichert = false;

  async function sichern() {
    if (gesichert || !(await exists(DATEI, opts))) return;
    const stempel = new Date().toISOString().replace(/[:.]/g, '-');
    await copyFile(DATEI, `${BACKUP_ORDNER}/finanzen-${stempel}.json`, { fromPathBaseDir: BaseDirectory.AppData, toPathBaseDir: BaseDirectory.AppData });
    const alte = (await readDir(BACKUP_ORDNER, opts))
      .map((e) => e.name)
      .filter((n) => n.startsWith('finanzen-'))
      .sort()
      .reverse()
      .slice(MAX_BACKUPS);
    for (const name of alte) await remove(`${BACKUP_ORDNER}/${name}`, opts);
    gesichert = true;
  }

  return {
    beschreibung: pfad,
    async load() {
      return (await exists(DATEI, opts)) ? readTextFile(DATEI, opts) : null;
    },
    async save(text) {
      await sichern();
      await writeTextFile(TEMP, text, opts);
      await rename(TEMP, DATEI, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
    },
  };
}
