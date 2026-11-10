import { mkdtemp, readdir, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { erstelleServer } from './sync-server';

const TOKEN = 'z'.repeat(40);
const tresor = (inhalt: string) =>
  JSON.stringify({ format: 'finanz-cockpit-tresor', version: 1, kdf: {}, iv: 'AAAA', daten: inhalt });

let ordner: string;
let basis: string;
let server: Server;

beforeEach(async () => {
  ordner = await mkdtemp(join(tmpdir(), 'sync-server-test-'));
  server = erstelleServer({
    datenOrdner: ordner,
    token: TOKEN,
    erlaubteUrspruenge: ['https://lisa.example'],
    maxVersionen: 2,
    maxBytes: 1000,
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((ok) => server.close(ok));
  await rm(ordner, { recursive: true, force: true });
});

function senden(body: string, kopf: Record<string, string>, token = TOKEN) {
  return fetch(`${basis}/tresor`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...kopf },
    body,
  });
}

function holen(kopf: Record<string, string> = {}) {
  return fetch(`${basis}/tresor`, { headers: { Authorization: `Bearer ${TOKEN}`, ...kopf } });
}

describe('Sync-Server', () => {
  it('antwortet auf /gesund ohne Zugangsschlüssel', async () => {
    const r = await fetch(`${basis}/gesund`);
    expect(r.status).toBe(200);
    expect(await r.text()).toBe('ok');
  });

  it('verlangt den richtigen Zugangsschlüssel', async () => {
    expect((await fetch(`${basis}/tresor`)).status).toBe(401);
    expect((await fetch(`${basis}/tresor`, { headers: { Authorization: 'Bearer falsch' } })).status).toBe(401);
    expect((await senden(tresor('a'), { 'If-None-Match': '*' }, 'falsch')).status).toBe(401);
  });

  it('meldet 404, solange es keinen Tresor gibt', async () => {
    expect((await holen()).status).toBe(404);
  });

  it('legt den ersten Tresor nur mit If-None-Match: * an', async () => {
    expect((await senden(tresor('a'), {})).status).toBe(428);
    const erst = await senden(tresor('a'), { 'If-None-Match': '*' });
    expect(erst.status).toBe(200);
    expect((await erst.json()).etag).toMatch(/^"[0-9a-f]{32}"$/);
    expect((await senden(tresor('b'), { 'If-None-Match': '*' })).status).toBe(412);
  });

  it('erkennt Konflikte über If-Match und liefert den neuesten Stand', async () => {
    const { etag: e1 } = await (await senden(tresor('a'), { 'If-None-Match': '*' })).json();
    const { etag: e2 } = await (await senden(tresor('b'), { 'If-Match': e1 })).json();

    const konflikt = await senden(tresor('c'), { 'If-Match': e1 }); // Gerät mit altem Stand
    expect(konflikt.status).toBe(412);
    expect((await konflikt.json()).etag).toBe(e2);

    const aktuell = await holen();
    expect(aktuell.headers.get('etag')).toBe(e2);
    expect(JSON.parse(await aktuell.text()).daten).toBe('b');
    expect((await holen({ 'If-None-Match': e2 })).status).toBe(304);
  });

  it('hebt frühere Stände auf, höchstens maxVersionen', async () => {
    let { etag } = await (await senden(tresor('1'), { 'If-None-Match': '*' })).json();
    for (const inhalt of ['2', '3', '4']) ({ etag } = await (await senden(tresor(inhalt), { 'If-Match': etag })).json());
    expect(await readdir(join(ordner, 'versionen'))).toHaveLength(2);
  });

  it('lehnt Fremdes und Übergroßes ab', async () => {
    expect((await senden('{"schemaVersion":1}', { 'If-None-Match': '*' })).status).toBe(400);
    expect((await senden('kein json', { 'If-None-Match': '*' })).status).toBe(400);
    expect((await senden(tresor('x'.repeat(2000)), { 'If-None-Match': '*' })).status).toBe(413);
  });

  it('erlaubt Browser-Zugriff nur von freigegebenen Herkünften', async () => {
    const erlaubt = await fetch(`${basis}/tresor`, { method: 'OPTIONS', headers: { Origin: 'https://lisa.example' } });
    expect(erlaubt.status).toBe(204);
    expect(erlaubt.headers.get('access-control-allow-origin')).toBe('https://lisa.example');
    expect(erlaubt.headers.get('access-control-expose-headers')).toBe('ETag');

    const fremd = await fetch(`${basis}/tresor`, { method: 'OPTIONS', headers: { Origin: 'https://boese.example' } });
    expect(fremd.headers.get('access-control-allow-origin')).toBeNull();
  });
});
