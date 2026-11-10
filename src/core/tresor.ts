/**
 * Tresor: Ende-zu-Ende-Verschlüsselung für den Sync (docs/entscheidungen/0002).
 *
 * Nur Web Crypto – eingebaut in jeden Browser, in Tauri und in Node, keine Fremdbibliothek.
 * - Schlüssel: PBKDF2-SHA-256 aus Passwort und zufälligem Salz, 600.000 Runden
 * - Verschlüsselung: AES-GCM-256 mit frischem 12-Byte-IV bei jedem Speichern
 * - Der Kopf (Format, Version, KDF-Parameter) ist als „zusätzliche Daten“ mitgeschützt:
 *   Wer ihn verändert, macht den Tresor unlesbar, statt die App zu täuschen.
 * Das Passwort verlässt das Gerät nie; ein Server sieht nur den fertigen Tresor.
 */

export const TRESOR_FORMAT = 'finanz-cockpit-tresor';
export const STANDARD_RUNDEN = 600_000;
/** Obergrenze, damit ein manipulierter Tresor das Gerät nicht minutenlang rechnen lässt. */
const MAX_RUNDEN = 10_000_000;
const PRUEFTEXT = 'finanz-cockpit-pruefwert';

export interface KdfInfo {
  name: 'PBKDF2-SHA-256';
  runden: number;
  /** Base64, 16 Byte */
  salz: string;
}

/** So liegt der Tresor auf dem Server: alles außer dem Kopf ist unlesbar. */
export interface Tresor {
  format: typeof TRESOR_FORMAT;
  version: 1;
  kdf: KdfInfo;
  /** Base64, 12 Byte */
  iv: string;
  /** Base64: verschlüsselte Daten samt GCM-Prüfsumme */
  daten: string;
}

/** Aus dem Passwort abgeleiteter Schlüssel samt den Parametern, mit denen er entstand. */
export interface Schluessel {
  key: CryptoKey;
  kdf: KdfInfo;
}

export class TresorFehler extends Error {}

/** Parameter für einen neuen Tresor: frisches Salz, Standard-Runden. */
export function neueKdf(runden = STANDARD_RUNDEN): KdfInfo {
  return { name: 'PBKDF2-SHA-256', runden, salz: zuBase64(crypto.getRandomValues(new Uint8Array(16))) };
}

export async function schluesselAusPasswort(passwort: string, kdf: KdfInfo): Promise<Schluessel> {
  if (passwort === '') throw new TresorFehler('Ohne Passwort gibt es keinen Schlüssel.');
  pruefeKdf(kdf);
  const basis = await crypto.subtle.importKey('raw', utf8(passwort), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: ausBase64(kdf.salz), iterations: kdf.runden },
    basis,
    { name: 'AES-GCM', length: 256 },
    false, // nicht exportierbar: Der Schlüssel kann das Gerät nicht als Rohdaten verlassen.
    ['encrypt', 'decrypt'],
  );
  return { key, kdf };
}

export async function verschluesseln(klartext: string, s: Schluessel): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const kopf = { format: TRESOR_FORMAT, version: 1, kdf: s.kdf } as const;
  const chiffre = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: utf8(kopfText(kopf)) },
    s.key,
    utf8(klartext),
  );
  const tresor: Tresor = { ...kopf, iv: zuBase64(iv), daten: zuBase64(new Uint8Array(chiffre)) };
  return JSON.stringify(tresor);
}

/** Liest Kopf und Form eines Tresors, ohne zu entschlüsseln (z. B. um das Salz zu erfahren). */
export function leseTresor(text: string): Tresor {
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    throw new TresorFehler('Das ist kein Tresor (kein gültiges JSON).');
  }
  const t = roh as Partial<Tresor> | null;
  if (!t || typeof t !== 'object' || t.format !== TRESOR_FORMAT) {
    throw new TresorFehler('Das ist kein Tresor des Finanz-Cockpits.');
  }
  if (t.version !== 1) throw new TresorFehler(`Unbekannte Tresor-Version ${String(t.version)}.`);
  if (!t.kdf || typeof t.iv !== 'string' || typeof t.daten !== 'string') {
    throw new TresorFehler('Der Tresor ist unvollständig.');
  }
  pruefeKdf(t.kdf);
  return t as Tresor;
}

export async function entschluesseln(text: string, s: Schluessel): Promise<string> {
  const t = leseTresor(text);
  if (t.kdf.salz !== s.kdf.salz || t.kdf.runden !== s.kdf.runden) {
    throw new TresorFehler('Dieser Tresor wurde mit einem anderen Passwort angelegt.');
  }
  try {
    const klar = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ausBase64(t.iv), additionalData: utf8(kopfText(t)) },
      s.key,
      ausBase64(t.daten),
    );
    return new TextDecoder().decode(klar);
  } catch {
    throw new TresorFehler('Passwort falsch oder Tresor beschädigt.');
  }
}

/**
 * Prüfwert: ein kleiner Tresor mit bekanntem Inhalt. Damit lässt sich ein Passwort auch offline
 * prüfen – und ein Tippfehler kann nie dazu führen, dass mit falschem Schlüssel hochgeladen wird.
 */
export function pruefwertErzeugen(s: Schluessel): Promise<string> {
  return verschluesseln(PRUEFTEXT, s);
}

export async function pruefwertPasst(pruefwert: string, s: Schluessel): Promise<boolean> {
  try {
    return (await entschluesseln(pruefwert, s)) === PRUEFTEXT;
  } catch {
    return false;
  }
}

function pruefeKdf(kdf: Partial<KdfInfo>): void {
  if (
    kdf.name !== 'PBKDF2-SHA-256' ||
    typeof kdf.salz !== 'string' ||
    !Number.isInteger(kdf.runden) ||
    (kdf.runden ?? 0) < 1 ||
    (kdf.runden ?? 0) > MAX_RUNDEN
  ) {
    throw new TresorFehler('Die Schlüssel-Parameter des Tresors sind ungültig.');
  }
}

function kopfText(k: { format: string; version: number; kdf: KdfInfo }): string {
  return JSON.stringify([k.format, k.version, k.kdf.name, k.kdf.runden, k.kdf.salz]);
}

function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}

function zuBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function ausBase64(text: string): Uint8Array<ArrayBuffer> {
  let s: string;
  try {
    s = atob(text);
  } catch {
    throw new TresorFehler('Der Tresor enthält ungültige Zeichen.');
  }
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}
