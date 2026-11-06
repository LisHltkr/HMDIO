/**
 * Sync-Server für das Finanz-Cockpit (Entwurf: docs/entscheidungen/0003, Betrieb: docs/pi-plan.md).
 *
 * Bewahrt genau einen Tresor auf. Der ist im Gerät verschlüsselt und für den Server unlesbar (0002).
 * Ohne Abhängigkeiten; Node ≥ 22.18 führt diese TypeScript-Datei direkt aus.
 *
 *   GET  /gesund  → "ok" (ohne Zugangsschlüssel, für Healthchecks)
 *   GET  /tresor  → Tresor + ETag; 304 bei If-None-Match = aktueller ETag; 404 solange leer
 *   PUT  /tresor  → speichert; verlangt If-Match: <ETag> oder If-None-Match: * (erster Tresor);
 *                   412, wenn ein anderes Gerät inzwischen gespeichert hat (Konflikt)
 *
 * Außer /gesund verlangt alles „Authorization: Bearer <Zugangsschlüssel>“. Der Schlüssel schützt
 * davor, dass Fremde den Tresor überschreiben; lesen könnten sie ihn ohnehin nicht.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface ServerEinstellungen {
  datenOrdner: string;
  token: string;
  /** Herkünfte, die per Browser zugreifen dürfen (CORS), z. B. https://name.github.io */
  erlaubteUrspruenge: string[];
  /** So viele frühere Stände bleiben in daten/versionen liegen. */
  maxVersionen: number;
  maxBytes: number;
  protokoll?: (zeile: string) => void;
}

const TRESOR = 'tresor.json';
const VERSIONEN = 'versionen';

export function erstelleServer(e: ServerEinstellungen): Server {
  const tokenHash = sha256(e.token);
  let kette: Promise<unknown> = Promise.resolve();

  /** Speichervorgänge laufen nacheinander, damit Prüfen und Schreiben sich nicht verzahnen. */
  function exklusiv<T>(fn: () => Promise<T>): Promise<T> {
    const ergebnis = kette.then(fn, fn);
    kette = ergebnis.catch(() => undefined);
    return ergebnis;
  }

  function berechtigt(req: IncomingMessage): boolean {
    const kopf = req.headers.authorization ?? '';
    return kopf.startsWith('Bearer ') && timingSafeEqual(sha256(kopf.slice(7)), tokenHash);
  }

  function corsSetzen(req: IncomingMessage, res: ServerResponse): void {
    const herkunft = req.headers.origin;
    if (!herkunft || !e.erlaubteUrspruenge.includes(herkunft)) return;
    res.setHeader('Access-Control-Allow-Origin', herkunft);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, If-Match, If-None-Match');
    res.setHeader('Access-Control-Expose-Headers', 'ETag');
    res.setHeader('Access-Control-Max-Age', '600');
  }

  async function aktuell(): Promise<{ text: string; etag: string } | null> {
    try {
      const text = await readFile(join(e.datenOrdner, TRESOR), 'utf8');
      return { text, etag: etagVon(text) };
    } catch (fehler) {
      if ((fehler as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw fehler;
    }
  }

  async function holen(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const jetzt = await aktuell();
    if (!jetzt) return antworten(res, 404, { fehler: 'Noch kein Tresor' });
    res.setHeader('ETag', jetzt.etag);
    if (req.headers['if-none-match'] === jetzt.etag) {
      res.statusCode = 304;
      res.end();
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(jetzt.text);
  }

  async function speichern(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const ifMatch = req.headers['if-match'];
    const ifNoneMatch = req.headers['if-none-match'];
    if (!ifMatch && ifNoneMatch !== '*') {
      return antworten(res, 428, { fehler: 'If-Match oder If-None-Match: * fehlt' });
    }
    if (Number(req.headers['content-length'] ?? 0) > e.maxBytes) {
      return antworten(res, 413, { fehler: `Größer als ${e.maxBytes} Byte` });
    }
    const text = await koerperLesen(req, e.maxBytes);
    if (text === null) return antworten(res, 413, { fehler: `Größer als ${e.maxBytes} Byte` });
    if (!siehtAusWieTresor(text)) return antworten(res, 400, { fehler: 'Das ist kein Tresor des Finanz-Cockpits' });

    await exklusiv(async () => {
      const jetzt = await aktuell();
      const passt = ifNoneMatch === '*' ? jetzt === null : jetzt !== null && ifMatch === jetzt.etag;
      if (!passt) {
        if (jetzt) res.setHeader('ETag', jetzt.etag);
        return antworten(res, 412, { fehler: 'Ein anderes Gerät hat inzwischen gespeichert', etag: jetzt?.etag ?? null });
      }
      await mkdir(join(e.datenOrdner, VERSIONEN), { recursive: true });
      if (jetzt) {
        const name = `${zeitstempel()}-${jetzt.etag.slice(1, 9)}.json`;
        await copyFile(join(e.datenOrdner, TRESOR), join(e.datenOrdner, VERSIONEN, name));
        await aufraeumen();
      }
      // Erst vollständig in eine Nachbardatei schreiben, dann umbenennen: nie ein halber Tresor.
      const tmp = join(e.datenOrdner, `${TRESOR}.tmp`);
      await writeFile(tmp, text, 'utf8');
      await rename(tmp, join(e.datenOrdner, TRESOR));
      const etag = etagVon(text);
      res.setHeader('ETag', etag);
      antworten(res, 200, { etag });
    });
  }

  async function aufraeumen(): Promise<void> {
    const ordner = join(e.datenOrdner, VERSIONEN);
    const alle = (await readdir(ordner)).filter((n) => n.endsWith('.json')).sort();
    for (const name of alle.slice(0, Math.max(0, alle.length - e.maxVersionen))) await rm(join(ordner, name));
  }

  async function bearbeiten(req: IncomingMessage, res: ServerResponse): Promise<void> {
    corsSetzen(req, res);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const pfad = pfadVon(req);
    if (pfad === '/gesund' && req.method === 'GET') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('ok');
      return;
    }
    if (pfad !== '/tresor') return antworten(res, 404, { fehler: 'Nicht gefunden' });
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (!berechtigt(req)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return antworten(res, 401, { fehler: 'Zugangsschlüssel fehlt oder stimmt nicht' });
    }
    if (req.method === 'GET') return holen(req, res);
    if (req.method === 'PUT') return speichern(req, res);
    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return antworten(res, 405, { fehler: 'Methode nicht erlaubt' });
  }

  return createServer((req, res) => {
    bearbeiten(req, res)
      .catch((fehler: unknown) => {
        e.protokoll?.(`Fehler: ${String(fehler)}`);
        if (!res.headersSent) antworten(res, 500, { fehler: 'Interner Fehler' });
        else res.destroy();
      })
      .finally(() => e.protokoll?.(`${req.method ?? '?'} ${pfadVon(req)} ${res.statusCode}`));
  });
}

function antworten(res: ServerResponse, status: number, inhalt: object): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(inhalt));
}

function koerperLesen(req: IncomingMessage, max: number): Promise<string | null> {
  return new Promise((ok, fehler) => {
    const teile: Buffer[] = [];
    let groesse = 0;
    req.on('data', (stueck: Buffer) => {
      groesse += stueck.length;
      if (groesse <= max) teile.push(stueck);
    });
    req.on('end', () => ok(groesse > max ? null : Buffer.concat(teile).toString('utf8')));
    req.on('error', fehler);
  });
}

/** Der Server kann den Inhalt nicht prüfen (verschlüsselt), nur die äußere Form. */
function siehtAusWieTresor(text: string): boolean {
  try {
    const t = JSON.parse(text) as { format?: unknown; daten?: unknown };
    return t.format === 'finanz-cockpit-tresor' && typeof t.daten === 'string';
  } catch {
    return false;
  }
}

function pfadVon(req: IncomingMessage): string {
  return new URL(req.url ?? '/', 'http://sync.invalid').pathname;
}

function sha256(text: string): Buffer {
  return createHash('sha256').update(text, 'utf8').digest();
}

function etagVon(text: string): string {
  return `"${sha256(text).toString('hex').slice(0, 32)}"`;
}

function zeitstempel(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function starte(): void {
  const env = process.env;
  const token = (env.TOKEN ?? (env.TOKEN_DATEI ? readFileSync(env.TOKEN_DATEI, 'utf8') : '')).trim();
  if (token.length < 32) {
    console.error('Zugangsschlüssel fehlt oder ist kürzer als 32 Zeichen. Setze TOKEN_DATEI (oder TOKEN).');
    process.exit(1);
  }
  const port = Number(env.PORT ?? 8787);
  const server = erstelleServer({
    datenOrdner: env.DATEN_ORDNER ?? './daten',
    token,
    erlaubteUrspruenge: (env.ERLAUBTE_URSPRUENGE ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    maxVersionen: Number(env.MAX_VERSIONEN ?? 30),
    maxBytes: Number(env.MAX_BYTES ?? 5_000_000),
    protokoll: (zeile) => console.log(`${new Date().toISOString()} ${zeile}`),
  });
  server.listen(port, env.HOST ?? '0.0.0.0', () => console.log(`Sync-Server lauscht auf Port ${port}`));
  const beenden = () => server.close(() => process.exit(0));
  process.on('SIGTERM', beenden);
  process.on('SIGINT', beenden);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) starte();
