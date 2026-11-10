import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { erstelleServer } from '../../server/sync-server';
import { TresorFehler } from '../core';
import { SyncFehler, createSync, pruefeAdresse, type SchluesselAblage, type TextAblage } from './sync';

/**
 * Spielt Laptop und iPhone gegen den echten Sync-Server durch (im Speicher, ohne Netz nach außen).
 * Testdaten sind erfunden; echte Finanzdaten gehören nie in Tests.
 */
const TOKEN = 'k'.repeat(40);
const PASSWORT = 'ein langer Testsatz';
const stand = (name: string) => JSON.stringify({ schemaVersion: 1, module: { probe: { name } } });

let ordner: string;
let server: Server;
let url: string;

beforeEach(async () => {
  ordner = await mkdtemp(join(tmpdir(), 'sync-test-'));
  server = erstelleServer({ datenOrdner: ordner, token: TOKEN, erlaubteUrspruenge: [], maxVersionen: 5, maxBytes: 1_000_000 });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((ok) => server.close(ok));
  await rm(ordner, { recursive: true, force: true });
});

function textAblage(): TextAblage & { wert: string | null } {
  return {
    wert: null,
    async lesen() {
      return this.wert;
    },
    async schreiben(text) {
      this.wert = text;
    },
  };
}

function schluesselAblage(): SchluesselAblage & { wert: CryptoKey | null } {
  return {
    wert: null,
    async lesen() {
      return this.wert;
    },
    async schreiben(key) {
      this.wert = key;
    },
  };
}

/** Ein Gerät mit eigenen Ablagen; `netz.weg = true` simuliert fehlendes Netz. */
function geraet(ablagen = { gemerkt: textAblage(), schluessel: schluesselAblage(), fallschirm: textAblage() }) {
  const netz = { weg: false };
  const sync = createSync({
    ...ablagen,
    fetch: (...args) => (netz.weg ? Promise.reject(new TypeError('Failed to fetch')) : fetch(...args)),
    runden: 1_000,
    sendeVerzoegerungMs: 0,
  });
  return { sync, ablagen, netz };
}

const zugang = () => ({ url, token: TOKEN });

describe('Sync', () => {
  it('richtet das erste Gerät ein, ein zweites tritt bei und bekommt dieselben Daten', async () => {
    const laptop = geraet();
    await laptop.sync.einrichtenNeu(zugang(), PASSWORT, stand('laptop'));
    expect(laptop.sync.status().art).toBe('aktuell');

    const handy = geraet();
    const daten = await handy.sync.einrichtenBeitreten(zugang(), PASSWORT, stand('leer'));
    expect(daten).toBe(stand('laptop'));
    expect(handy.ablagen.fallschirm.wert).toBe(stand('leer'));
  });

  it('legt auf dem Server nur Unlesbares ab', async () => {
    const laptop = geraet();
    await laptop.sync.einrichtenNeu(zugang(), PASSWORT, stand('Kontostand 4711 Euro'));
    const aufDemServer = await readFile(join(ordner, 'tresor.json'), 'utf8');
    expect(aufDemServer).toContain('finanz-cockpit-tresor');
    expect(aufDemServer).not.toContain('4711');
    expect(aufDemServer).not.toContain(PASSWORT);
  });

  it('lehnt beim Beitreten ein falsches Passwort ab und merkt sich nichts', async () => {
    await geraet().sync.einrichtenNeu(zugang(), PASSWORT, stand('laptop'));
    const handy = geraet();
    await expect(handy.sync.einrichtenBeitreten(zugang(), 'ein falscher Testsatz', stand('leer'))).rejects.toThrow(TresorFehler);
    expect(handy.sync.status().art).toBe('aus');
    expect(handy.ablagen.gemerkt.wert).toBeNull();
  });

  it('bringt Änderungen vom Laptop aufs Handy', async () => {
    const laptop = geraet();
    await laptop.sync.einrichtenNeu(zugang(), PASSWORT, stand('v1'));
    const handy = geraet();
    await handy.sync.einrichtenBeitreten(zugang(), PASSWORT, stand('leer'));

    laptop.sync.geaendert(stand('v2'));
    await laptop.sync.leeren();
    expect(await handy.sync.abgleichen(stand('v1'))).toBe(stand('v2'));
    expect(await handy.sync.abgleichen(stand('v2'))).toBeNull(); // nichts Neues: 304
  });

  it('meldet einen Konflikt statt zu überschreiben – „Server übernehmen“ legt den eigenen Stand zur Seite', async () => {
    const laptop = geraet();
    await laptop.sync.einrichtenNeu(zugang(), PASSWORT, stand('v1'));
    const handy = geraet();
    await handy.sync.einrichtenBeitreten(zugang(), PASSWORT, stand('leer'));

    laptop.sync.geaendert(stand('vom Laptop'));
    await laptop.sync.leeren();
    handy.sync.geaendert(stand('vom Handy')); // ohne vorher abzugleichen
    await handy.sync.leeren();
    expect(handy.sync.status().art).toBe('konflikt');

    expect(await handy.sync.konfliktLoesen('server', stand('vom Handy'))).toBe(stand('vom Laptop'));
    expect(handy.ablagen.fallschirm.wert).toBe(stand('vom Handy'));
    expect(handy.sync.status().art).toBe('aktuell');
  });

  it('löst einen Konflikt mit „meinen Stand behalten“ und legt den Serverstand zur Seite', async () => {
    const laptop = geraet();
    await laptop.sync.einrichtenNeu(zugang(), PASSWORT, stand('v1'));
    const handy = geraet();
    await handy.sync.einrichtenBeitreten(zugang(), PASSWORT, stand('leer'));

    laptop.sync.geaendert(stand('vom Laptop'));
    await laptop.sync.leeren();
    handy.sync.geaendert(stand('vom Handy'));
    await handy.sync.leeren();

    expect(await handy.sync.konfliktLoesen('meine', stand('vom Handy'))).toBeNull();
    expect(handy.ablagen.fallschirm.wert).toBe(stand('vom Laptop'));
    expect(await laptop.sync.abgleichen(stand('vom Laptop'))).toBe(stand('vom Handy'));
  });

  it('arbeitet ohne Netz weiter und sendet später', async () => {
    const laptop = geraet();
    await laptop.sync.einrichtenNeu(zugang(), PASSWORT, stand('v1'));
    laptop.netz.weg = true;
    laptop.sync.geaendert(stand('offline geändert'));
    await laptop.sync.leeren();
    expect(laptop.sync.status().art).toBe('offline');
    expect(JSON.parse(laptop.ablagen.gemerkt.wert!).ungesendet).toBe(true);

    laptop.netz.weg = false;
    expect(await laptop.sync.abgleichen(stand('offline geändert'))).toBeNull();
    expect(laptop.sync.status().art).toBe('aktuell');
    const handy = geraet();
    expect(await handy.sync.einrichtenBeitreten(zugang(), PASSWORT, stand('leer'))).toBe(stand('offline geändert'));
  });

  it('braucht nach einem Neustart kein Passwort – ohne gemerkten Schlüssel ist er gesperrt', async () => {
    const laptop = geraet();
    await laptop.sync.einrichtenNeu(zugang(), PASSWORT, stand('v1'));

    const neustart = geraet(laptop.ablagen);
    await neustart.sync.start();
    expect(neustart.sync.status().art).toBe('aktuell');

    laptop.ablagen.schluessel.wert = null;
    const ohneSchluessel = geraet(laptop.ablagen);
    await ohneSchluessel.sync.start();
    expect(ohneSchluessel.sync.status().art).toBe('gesperrt');
    await expect(ohneSchluessel.sync.entsperren('ein falscher Testsatz')).rejects.toThrow('Das Passwort stimmt nicht.');
    await ohneSchluessel.sync.entsperren(PASSWORT);
    expect(ohneSchluessel.sync.status().art).toBe('aktuell');
  });

  it('prüft Adresse, Zugangsschlüssel und Passwort', async () => {
    expect(pruefeAdresse(' https://finanz-pi.beispiel.ts.net/ ')).toBe('https://finanz-pi.beispiel.ts.net');
    expect(pruefeAdresse('http://localhost:8787')).toBe('http://localhost:8787');
    expect(() => pruefeAdresse('http://finanz-pi.beispiel.ts.net')).toThrow(SyncFehler);
    expect(() => pruefeAdresse('kein link')).toThrow(SyncFehler);
    const g = geraet();
    await expect(g.sync.einrichtenNeu({ url, token: 'kurz' }, PASSWORT, stand('x'))).rejects.toThrow(SyncFehler);
    await expect(g.sync.einrichtenNeu(zugang(), 'zu kurz', stand('x'))).rejects.toThrow('mindestens 12 Zeichen');
    await expect(g.sync.einrichtenNeu({ url, token: 'f'.repeat(40) }, PASSWORT, stand('x'))).rejects.toThrow('Zugangsschlüssel stimmt nicht');
  });

  it('verhindert einen zweiten Tresor', async () => {
    await geraet().sync.einrichtenNeu(zugang(), PASSWORT, stand('laptop'));
    await expect(geraet().sync.einrichtenNeu(zugang(), PASSWORT, stand('handy'))).rejects.toThrow('schon ein Tresor');
  });
});
