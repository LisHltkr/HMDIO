import type { SchluesselAblage, TextAblage } from './sync';

/** Kleine Ablagen für Sync-Einstellungen, Fallschirm und Schlüssel – im Browser wie in der Desktop-App. */

export const SYNC_KEY = 'finanz-cockpit/sync';
export const FALLSCHIRM_KEY = 'finanz-cockpit/fallschirm.json';

export function localStorageAblage(key: string): TextAblage {
  return {
    async lesen() {
      return localStorage.getItem(key);
    },
    async schreiben(text) {
      if (text === null) localStorage.removeItem(key);
      else localStorage.setItem(key, text);
    },
  };
}

/** Der Stand, der zuletzt ersetzt wurde (Konfliktlösung, Beitreten, Einlesen einer Sicherung). */
export function fallschirmAblage(): TextAblage {
  return localStorageAblage(FALLSCHIRM_KEY);
}

/**
 * Speichert den Sync-Schlüssel in IndexedDB. Der Schlüssel ist nicht exportierbar:
 * Er lässt sich auf diesem Gerät benutzen, aber nicht als Rohdaten auslesen.
 */
export function indexedDbSchluesselAblage(): SchluesselAblage {
  const DB = 'finanz-cockpit';
  const ABLAGE = 'schluessel';
  const ID = 'sync';

  function oeffnen(): Promise<IDBDatabase> {
    return new Promise((ok, fehler) => {
      const anfrage = indexedDB.open(DB, 1);
      anfrage.onupgradeneeded = () => anfrage.result.createObjectStore(ABLAGE);
      anfrage.onsuccess = () => ok(anfrage.result);
      anfrage.onerror = () => fehler(anfrage.error);
    });
  }

  async function mitAblage<T>(modus: IDBTransactionMode, tun: (a: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await oeffnen();
    try {
      return await new Promise<T>((ok, fehler) => {
        const tx = db.transaction(ABLAGE, modus);
        const anfrage = tun(tx.objectStore(ABLAGE));
        tx.oncomplete = () => ok(anfrage.result as T);
        tx.onerror = () => fehler(tx.error);
        tx.onabort = () => fehler(tx.error);
      });
    } finally {
      db.close();
    }
  }

  return {
    async lesen() {
      if (typeof indexedDB === 'undefined') return null;
      return (await mitAblage<CryptoKey | undefined>('readonly', (a) => a.get(ID))) ?? null;
    },
    async schreiben(key) {
      if (typeof indexedDB === 'undefined') return;
      await mitAblage('readwrite', (a) => (key ? a.put(key, ID) : a.delete(ID)));
    },
  };
}
