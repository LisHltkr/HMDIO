import {
  STANDARD_RUNDEN,
  TresorFehler,
  entschluesseln,
  leseTresor,
  neueKdf,
  pruefwertErzeugen,
  pruefwertPasst,
  schluesselAusPasswort,
  verschluesseln,
  type KdfInfo,
  type Schluessel,
} from '../core';

/**
 * Sync zwischen Geräten über den Sync-Server (docs/entscheidungen/0002 und 0003).
 *
 * Grundsätze:
 * - Lokal gespeichert wird immer zuerst. Der Sync kann das Speichern nie verhindern.
 * - Gesendet wird nur verschlüsselt und nur mit If-Match, also nie still über einen fremden Stand.
 * - Konflikte entscheidet die Person, die die App benutzt; der überschriebene Stand landet im Fallschirm.
 * - Das Gerät merkt sich Adresse, Zugangsschlüssel, ETag und ob etwas ungesendet ist – nie das Passwort.
 */

export interface SyncZugang {
  url: string;
  token: string;
}

export type SyncStatus =
  | { art: 'aus' }
  | { art: 'gesperrt' }
  | { art: 'arbeitet' }
  | { art: 'aktuell'; zuletzt: string | null }
  | { art: 'offline'; meldung: string }
  | { art: 'konflikt' }
  | { art: 'fehler'; meldung: string };

export interface TextAblage {
  lesen(): Promise<string | null>;
  schreiben(text: string | null): Promise<void>;
}

export interface SchluesselAblage {
  lesen(): Promise<CryptoKey | null>;
  schreiben(key: CryptoKey | null): Promise<void>;
}

export interface SyncAbhaengigkeiten {
  /** Einstellungen und Zustand dieses Geräts (ohne Passwort). */
  gemerkt: TextAblage;
  /** Der nicht exportierbare Schlüssel, damit das Passwort nur einmal pro Gerät nötig ist. */
  schluessel: SchluesselAblage;
  /** Hier landet ein Stand, bevor er bei einer Konfliktlösung ersetzt wird. */
  fallschirm: TextAblage;
  fetch: typeof fetch;
  jetzt?: () => string;
  /** Nur für Tests kleiner; sonst STANDARD_RUNDEN. */
  runden?: number;
  sendeVerzoegerungMs?: number;
}

export interface Sync {
  start(): Promise<void>;
  status(): SyncStatus;
  abonnieren(hoerer: () => void): () => void;
  adresse(): string | null;
  /** Erstes Gerät: legt den Tresor mit den Daten dieses Geräts an. */
  einrichtenNeu(zugang: SyncZugang, passwort: string, klartext: string): Promise<void>;
  /** Weiteres Gerät: holt den Tresor und gibt seine Daten zurück; der bisherige Stand geht in den Fallschirm. */
  einrichtenBeitreten(zugang: SyncZugang, passwort: string, bisher: string): Promise<string>;
  entsperren(passwort: string): Promise<void>;
  /** Sendet Ungesendetes oder holt Neueres. Gibt Daten zurück, wenn die App sie übernehmen soll. */
  abgleichen(klartext: string): Promise<string | null>;
  /** Nach jedem lokalen Speichern: sendet verzögert. */
  geaendert(klartext: string): void;
  /** Die App hat Daten vom Server übernommen; das ist ihr Text dafür. */
  uebernommen(klartext: string): void;
  konfliktLoesen(wahl: 'server' | 'meine', klartext: string): Promise<string | null>;
  /** Wartet, bis alles Anstehende gesendet ist. */
  leeren(): Promise<void>;
  melden(meldung: string): void;
  ausschalten(): Promise<void>;
}

export class SyncFehler extends Error {}

class NetzFehler extends SyncFehler {
  constructor() {
    super('Sync-Server nicht erreichbar. Läuft Tailscale auf diesem Gerät, und stimmt die Adresse?');
  }
}

interface Gemerkt extends SyncZugang {
  kdf: KdfInfo;
  pruefwert: string;
  etag: string | null;
  ungesendet: boolean;
  zuletzt: string | null;
}

const MIN_PASSWORT = 12;
const MIN_TOKEN = 32;

/** Prüft und vereinheitlicht die Server-Adresse. HTTPS ist Pflicht, außer für localhost. */
export function pruefeAdresse(eingabe: string): string {
  let url: URL;
  try {
    url = new URL(eingabe.trim());
  } catch {
    throw new SyncFehler('Das ist keine gültige Adresse, gemeint ist z. B. https://finanz-pi.dein-tailnet.ts.net');
  }
  const lokal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && lokal)) {
    throw new SyncFehler('Die Adresse muss mit https:// beginnen (http geht nur für localhost).');
  }
  return url.origin + url.pathname.replace(/\/+$/, '');
}

function pruefeZugang(z: SyncZugang): SyncZugang {
  const token = z.token.trim();
  if (token.length < MIN_TOKEN) {
    throw new SyncFehler(`Der Zugangsschlüssel ist zu kurz (mindestens ${MIN_TOKEN} Zeichen; er steht in token.txt auf dem Pi).`);
  }
  return { url: pruefeAdresse(z.url), token };
}

function pruefePasswort(passwort: string): void {
  if (passwort.length < MIN_PASSWORT) throw new SyncFehler(`Das Passwort braucht mindestens ${MIN_PASSWORT} Zeichen.`);
}

export function createSync(d: SyncAbhaengigkeiten): Sync {
  const jetzt = d.jetzt ?? (() => new Date().toISOString());
  const verzoegerung = d.sendeVerzoegerungMs ?? 1500;
  let gemerkt: Gemerkt | null = null;
  let schluessel: Schluessel | null = null;
  let status: SyncStatus = { art: 'aus' };
  /** Klartext, der dem Stand auf dem Server entspricht (nur im Arbeitsspeicher). */
  let serverKlartext: string | null = null;
  let wartend: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let laufend: Promise<void> | null = null;
  const hoerer = new Set<() => void>();

  function setze(s: SyncStatus): void {
    status = s;
    hoerer.forEach((h) => h());
  }

  function aktuell(): SyncStatus {
    return { art: 'aktuell', zuletzt: gemerkt?.zuletzt ?? null };
  }

  async function merken(g: Gemerkt | null): Promise<void> {
    gemerkt = g;
    await d.gemerkt.schreiben(g ? JSON.stringify(g) : null);
  }

  async function schluesselMerken(key: CryptoKey | null): Promise<void> {
    // Nur Komfort: Schlägt das Merken fehl, fragt die App beim nächsten Start nach dem Passwort.
    await d.schluessel.schreiben(key).catch(() => undefined);
  }

  function behandle(fehler: unknown): void {
    if (fehler instanceof NetzFehler) setze({ art: 'offline', meldung: fehler.message });
    else if (fehler instanceof SyncFehler || fehler instanceof TresorFehler) setze({ art: 'fehler', meldung: fehler.message });
    else setze({ art: 'fehler', meldung: String(fehler) });
  }

  async function anfrage(z: SyncZugang, methode: 'GET' | 'PUT', kopf: Record<string, string>, body?: string): Promise<Response> {
    try {
      return await d.fetch(`${z.url}/tresor`, {
        method: methode,
        headers: { Authorization: `Bearer ${z.token}`, ...kopf },
        body,
        cache: 'no-store',
      });
    } catch {
      throw new NetzFehler();
    }
  }

  function antwortFehler(r: Response): SyncFehler {
    if (r.status === 401) return new SyncFehler('Der Zugangsschlüssel stimmt nicht.');
    return new SyncFehler(`Der Sync-Server antwortet mit ${r.status}.`);
  }

  function etagAus(r: Response): string {
    const etag = r.headers.get('ETag');
    if (!etag) throw new SyncFehler('Der Sync-Server liefert keinen ETag (CORS: Access-Control-Expose-Headers?).');
    return etag;
  }

  async function holeTresor(z: SyncZugang): Promise<{ text: string; etag: string } | null> {
    const r = await anfrage(z, 'GET', {});
    if (r.status === 404) return null;
    if (!r.ok) throw antwortFehler(r);
    return { etag: etagAus(r), text: await r.text() };
  }

  async function senden(klartext: string): Promise<void> {
    if (!gemerkt || !schluessel) return;
    if (klartext === serverKlartext) {
      if (gemerkt.ungesendet) await merken({ ...gemerkt, ungesendet: false });
      setze(aktuell());
      return;
    }
    setze({ art: 'arbeitet' });
    const vorbedingung: Record<string, string> = gemerkt.etag ? { 'If-Match': gemerkt.etag } : { 'If-None-Match': '*' };
    const r = await anfrage(gemerkt, 'PUT', { 'Content-Type': 'application/json', ...vorbedingung }, await verschluesseln(klartext, schluessel));
    if (r.status === 412) {
      setze({ art: 'konflikt' });
      return;
    }
    if (!r.ok) throw antwortFehler(r);
    const { etag } = (await r.json()) as { etag: string };
    serverKlartext = klartext;
    await merken({ ...gemerkt, etag, ungesendet: false, zuletzt: jetzt() });
    setze(aktuell());
  }

  /** Sendet nacheinander, immer den neuesten wartenden Stand. */
  function pumpe(): Promise<void> {
    if (laufend) return laufend;
    laufend = (async () => {
      try {
        while (wartend !== null && status.art !== 'konflikt') {
          const text = wartend;
          wartend = null;
          await senden(text);
        }
      } catch (fehler) {
        behandle(fehler);
      } finally {
        laufend = null;
      }
    })();
    return laufend;
  }

  const sync: Sync = {
    async start() {
      const roh = await d.gemerkt.lesen();
      if (!roh) return setze({ art: 'aus' });
      try {
        gemerkt = JSON.parse(roh) as Gemerkt;
      } catch {
        return setze({ art: 'fehler', meldung: 'Die Sync-Einstellungen sind beschädigt. Schalte Sync aus und richte ihn neu ein.' });
      }
      const key = await d.schluessel.lesen().catch(() => null);
      const s = key ? { key, kdf: gemerkt.kdf } : null;
      if (!s || !(await pruefwertPasst(gemerkt.pruefwert, s))) return setze({ art: 'gesperrt' });
      schluessel = s;
      setze(aktuell());
    },

    status: () => status,

    abonnieren(h) {
      hoerer.add(h);
      return () => {
        hoerer.delete(h);
      };
    },

    adresse: () => gemerkt?.url ?? null,

    async einrichtenNeu(zugang, passwort, klartext) {
      const z = pruefeZugang(zugang);
      pruefePasswort(passwort);
      if (await holeTresor(z)) {
        throw new SyncFehler('Auf dem Server liegt schon ein Tresor. Wähle „Weiteres Gerät verbinden“.');
      }
      const kdf = neueKdf(d.runden ?? STANDARD_RUNDEN);
      const s = await schluesselAusPasswort(passwort, kdf);
      const r = await anfrage(z, 'PUT', { 'Content-Type': 'application/json', 'If-None-Match': '*' }, await verschluesseln(klartext, s));
      if (r.status === 412) throw new SyncFehler('Ein anderes Gerät hat gerade einen Tresor angelegt. Wähle „Weiteres Gerät verbinden“.');
      if (!r.ok) throw antwortFehler(r);
      const { etag } = (await r.json()) as { etag: string };
      schluessel = s;
      serverKlartext = klartext;
      await schluesselMerken(s.key);
      await merken({ ...z, kdf, pruefwert: await pruefwertErzeugen(s), etag, ungesendet: false, zuletzt: jetzt() });
      setze(aktuell());
    },

    async einrichtenBeitreten(zugang, passwort, bisher) {
      const z = pruefeZugang(zugang);
      const tresor = await holeTresor(z);
      if (!tresor) throw new SyncFehler('Auf dem Server liegt noch kein Tresor. Richte zuerst das Gerät ein, das deine Daten hat.');
      const s = await schluesselAusPasswort(passwort, leseTresor(tresor.text).kdf);
      const text = await entschluesseln(tresor.text, s); // falsches Passwort: TresorFehler, nichts wird gemerkt
      await d.fallschirm.schreiben(bisher);
      schluessel = s;
      serverKlartext = text;
      await schluesselMerken(s.key);
      await merken({ ...z, kdf: s.kdf, pruefwert: await pruefwertErzeugen(s), etag: tresor.etag, ungesendet: false, zuletzt: jetzt() });
      setze(aktuell());
      return text;
    },

    async entsperren(passwort) {
      if (!gemerkt) throw new SyncFehler('Sync ist auf diesem Gerät nicht eingerichtet.');
      const s = await schluesselAusPasswort(passwort, gemerkt.kdf);
      if (!(await pruefwertPasst(gemerkt.pruefwert, s))) throw new SyncFehler('Das Passwort stimmt nicht.');
      schluessel = s;
      await schluesselMerken(s.key);
      setze(aktuell());
    },

    async abgleichen(klartext) {
      if (!gemerkt || !schluessel || status.art === 'konflikt') return null;
      try {
        if (gemerkt.ungesendet || (serverKlartext !== null && klartext !== serverKlartext)) {
          wartend = klartext;
          await pumpe();
          return null;
        }
        setze({ art: 'arbeitet' });
        const r = await anfrage(gemerkt, 'GET', gemerkt.etag ? { 'If-None-Match': gemerkt.etag } : {});
        if (r.status === 304) {
          setze(aktuell());
          return null;
        }
        if (r.status === 404) {
          // Tresor fehlt auf dem Server (z. B. neu aufgesetzt): mit dem Stand dieses Geräts neu anlegen.
          await merken({ ...gemerkt, etag: null, ungesendet: true });
          wartend = klartext;
          await pumpe();
          return null;
        }
        if (!r.ok) throw antwortFehler(r);
        const etag = etagAus(r);
        const text = await entschluesseln(await r.text(), schluessel);
        serverKlartext = text;
        await merken({ ...gemerkt, etag, zuletzt: jetzt() });
        setze(aktuell());
        return text === klartext ? null : text;
      } catch (fehler) {
        behandle(fehler);
        return null;
      }
    },

    geaendert(klartext) {
      if (!gemerkt || (klartext === serverKlartext && !gemerkt.ungesendet)) return;
      wartend = klartext;
      if (!gemerkt.ungesendet) void merken({ ...gemerkt, ungesendet: true });
      if (!schluessel || status.art === 'konflikt') return; // bleibt vorgemerkt
      clearTimeout(timer);
      timer = setTimeout(() => void pumpe(), verzoegerung);
    },

    uebernommen(klartext) {
      serverKlartext = klartext;
    },

    async konfliktLoesen(wahl, klartext) {
      if (!gemerkt || !schluessel) return null;
      try {
        setze({ art: 'arbeitet' });
        const tresor = await holeTresor(gemerkt);
        if (!tresor) {
          await merken({ ...gemerkt, etag: null, ungesendet: true });
          wartend = klartext;
          await pumpe();
          return null;
        }
        const serverText = await entschluesseln(tresor.text, schluessel);
        if (wahl === 'server') {
          await d.fallschirm.schreiben(klartext);
          serverKlartext = serverText;
          await merken({ ...gemerkt, etag: tresor.etag, ungesendet: false, zuletzt: jetzt() });
          setze(aktuell());
          return serverText;
        }
        await d.fallschirm.schreiben(serverText);
        await merken({ ...gemerkt, etag: tresor.etag, ungesendet: true });
        wartend = klartext;
        await pumpe();
        return null;
      } catch (fehler) {
        behandle(fehler);
        return null;
      }
    },

    async leeren() {
      clearTimeout(timer);
      if (wartend !== null) await pumpe();
      else if (laufend) await laufend;
    },

    melden(meldung) {
      setze({ art: 'fehler', meldung });
    },

    async ausschalten() {
      clearTimeout(timer);
      wartend = null;
      schluessel = null;
      serverKlartext = null;
      await schluesselMerken(null);
      await merken(null);
      setze({ art: 'aus' });
    },
  };
  return sync;
}
