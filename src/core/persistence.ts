import type { AppData, FeatureModule } from './module';

export const SCHEMA_VERSION = 1;

/** Wo die JSON-Datei liegt, entscheidet der Adapter (Tauri-Datei oder Browser). */
export interface StorageAdapter {
  beschreibung: string;
  load(): Promise<string | null>;
  save(text: string): Promise<void>;
}

/**
 * Migrationen von Version n auf n+1. Wird das Datenformat geändert, kommt hier
 * ein Eintrag dazu und SCHEMA_VERSION wird erhöht.
 */
const migrationen: Record<number, (raw: AppData) => AppData> = {};

export class DatenFehler extends Error {}

export function leereDaten(modules: FeatureModule[]): AppData {
  const data: AppData = { schemaVersion: SCHEMA_VERSION, module: {} };
  for (const m of modules) if (m.daten) data.module[m.id] = m.daten.initial();
  return data;
}

/**
 * Liest und prüft die gespeicherte Datei. Fehlerhafte Daten werden nie stillschweigend
 * verworfen, sondern als DatenFehler gemeldet, damit nichts verloren geht.
 */
export function parseAppData(text: string, modules: FeatureModule[]): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DatenFehler('Die Datei ist kein gültiges JSON.');
  }
  if (typeof raw !== 'object' || raw === null || typeof (raw as AppData).schemaVersion !== 'number') {
    throw new DatenFehler('Die Datei hat kein bekanntes Format (schemaVersion fehlt).');
  }
  let data = raw as AppData;
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new DatenFehler(`Die Datei stammt von einer neueren Version (${data.schemaVersion}).`);
  }
  while (data.schemaVersion < SCHEMA_VERSION) {
    const migrate = migrationen[data.schemaVersion];
    if (!migrate) throw new DatenFehler(`Keine Migration von Version ${data.schemaVersion}.`);
    data = migrate(data);
  }

  const result: AppData = { schemaVersion: SCHEMA_VERSION, module: { ...(data.module ?? {}) } };
  for (const m of modules) {
    if (!m.daten) continue;
    const value = result.module[m.id];
    if (value === undefined) {
      result.module[m.id] = m.daten.initial();
      continue;
    }
    const parsed = m.daten.schema.safeParse(value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new DatenFehler(`Daten von „${m.id}“ sind ungültig: ${issue?.path.join('.')} – ${issue?.message}`);
    }
    result.module[m.id] = parsed.data;
  }
  return result;
}

export function serializeAppData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}
