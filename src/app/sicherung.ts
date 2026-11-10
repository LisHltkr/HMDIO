import { DatenFehler, clock, parseAppData, type AppData } from '../core';
import { laeuftInTauri } from '../storage';
import { MODULE } from './modules';

/** Sicherung = alle Daten als Datei (unverschlüsselt), zum Aufheben oder Umziehen. */

export function dateiname(art = 'sicherung'): string {
  return `finanz-cockpit-${art}-${clock().heute()}.json`;
}

/**
 * Gibt eine Datei aus: Desktop-App → Unterordner „exporte“ im App-Ordner,
 * Handy → Teilen-Menü („In Dateien sichern“), sonst → Download. Rückgabe: Hinweis für die Oberfläche.
 */
export async function exportieren(text: string, name = dateiname()): Promise<string> {
  if (laeuftInTauri()) {
    const { exportiereInAppOrdner } = await import('../storage/tauriFile');
    return `Gespeichert unter ${await exportiereInAppOrdner(name, text)}`;
  }
  const datei = new File([text], name, { type: 'application/json' });
  const beruehrung = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (beruehrung && navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: name });
      return 'Geteilt. Tipp: „In Dateien sichern“ legt die Datei in iCloud Drive ab.';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'Abgebrochen.';
      throw e;
    }
  }
  const url = URL.createObjectURL(datei);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return `Heruntergeladen: ${name}`;
}

/** Liest eine Sicherungsdatei und prüft sie vollständig, bevor irgendetwas ersetzt wird. */
export async function sicherungLesen(datei: File): Promise<AppData> {
  const text = await datei.text();
  if (text.includes('"finanz-cockpit-tresor"')) {
    throw new DatenFehler('Das ist der verschlüsselte Tresor vom Sync-Server, keine Sicherung. Verbinde das Gerät stattdessen über „Sync“.');
  }
  return parseAppData(text, MODULE);
}
