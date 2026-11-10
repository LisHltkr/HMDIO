import { useSyncExternalStore } from 'react';
import { DatenFehler, TresorFehler, parseAppData, serializeAppData, store } from '../core';
import { SyncFehler, type Sync, type SyncStatus } from '../storage/sync';
import { MODULE } from './modules';

/** Verbindet den Sync (storage) mit dem Zustand der App (core). */

/** Der aktuelle Stand als Text, so wie er gespeichert und gesendet wird. */
export function lokalerText(): string {
  return serializeAppData(store().get());
}

/** Übernimmt Daten vom Server in die App und sagt dem Sync, welcher Text dazugehört. */
export function datenUebernehmen(sync: Sync, klartext: string): void {
  const daten = parseAppData(klartext, MODULE); // prüft vollständig, bevor etwas ersetzt wird
  store().set(daten);
  sync.uebernommen(serializeAppData(daten));
}

/** Gleicht ab und übernimmt Neueres. Fehler landen im Sync-Status, nie als Absturz. */
export async function jetztAbgleichen(sync: Sync): Promise<void> {
  const neu = await sync.abgleichen(lokalerText());
  if (!neu) return;
  try {
    datenUebernehmen(sync, neu);
  } catch (e) {
    sync.melden(`Die Daten vom Server passen nicht zu dieser App-Version: ${meldungAus(e)}`);
  }
}

export function useSyncStatus(sync: Sync): SyncStatus {
  return useSyncExternalStore(sync.abonnieren, sync.status);
}

export function statusKurz(s: SyncStatus): string {
  switch (s.art) {
    case 'aus':
      return 'Sync aus';
    case 'gesperrt':
      return 'Sync gesperrt';
    case 'arbeitet':
      return 'Sync läuft …';
    case 'aktuell':
      return s.zuletzt ? `Sync aktuell · ${zeitpunkt(s.zuletzt)}` : 'Sync aktuell';
    case 'offline':
      return 'Sync wartet auf Verbindung';
    case 'konflikt':
      return 'Sync: Konflikt';
    case 'fehler':
      return 'Sync: Fehler';
  }
}

/** Fehlermeldungen, die für Menschen geschrieben sind, so zeigen; alles andere als „unerwartet“ kennzeichnen. */
export function meldungAus(e: unknown): string {
  if (e instanceof SyncFehler || e instanceof TresorFehler || e instanceof DatenFehler) return e.message;
  return `Unerwarteter Fehler: ${String(e)}`;
}

function zeitpunkt(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
