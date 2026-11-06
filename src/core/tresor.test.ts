import { describe, expect, it } from 'vitest';
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
} from './tresor';

// Tests brauchen keine 600.000 Runden; das Verfahren ist dasselbe.
const SCHNELL = 1_000;

describe('tresor', () => {
  it('nutzt im Normalfall 600.000 Runden', () => {
    expect(neueKdf().runden).toBe(STANDARD_RUNDEN);
    expect(STANDARD_RUNDEN).toBe(600_000);
  });

  it('verschlüsselt verlustfrei, auch Umlaute und große Daten', async () => {
    const s = await schluesselAusPasswort('ein langer Testsatz', neueKdf(SCHNELL));
    const klartext = JSON.stringify({ text: 'Grüße, 1.234,56 €', viel: 'x'.repeat(200_000) });
    const tresor = await verschluesseln(klartext, s);
    expect(tresor).not.toContain('Grüße');
    expect(await entschluesseln(tresor, s)).toBe(klartext);
  });

  it('nimmt bei jedem Speichern einen neuen IV', async () => {
    const s = await schluesselAusPasswort('ein langer Testsatz', neueKdf(SCHNELL));
    const a = leseTresor(await verschluesseln('gleich', s));
    const b = leseTresor(await verschluesseln('gleich', s));
    expect(a.iv).not.toBe(b.iv);
    expect(a.daten).not.toBe(b.daten);
  });

  it('lehnt ein falsches Passwort ab', async () => {
    const kdf = neueKdf(SCHNELL);
    const tresor = await verschluesseln('geheim', await schluesselAusPasswort('richtiges Passwort', kdf));
    const falsch = await schluesselAusPasswort('falsches Passwort', kdf);
    await expect(entschluesseln(tresor, falsch)).rejects.toThrow(TresorFehler);
  });

  it('erkennt veränderte Daten', async () => {
    const s = await schluesselAusPasswort('ein langer Testsatz', neueKdf(SCHNELL));
    const t = leseTresor(await verschluesseln('Kontostand 100', s));
    const kippe = t.daten.startsWith('A') ? 'B' : 'A';
    const veraendert = JSON.stringify({ ...t, daten: kippe + t.daten.slice(1) });
    await expect(entschluesseln(veraendert, s)).rejects.toThrow('Passwort falsch oder Tresor beschädigt.');
  });

  it('erkennt einen veränderten Kopf, auch mit passend abgeleitetem Schlüssel', async () => {
    const kdf = neueKdf(SCHNELL);
    const t = leseTresor(await verschluesseln('geheim', await schluesselAusPasswort('richtiges Passwort', kdf)));
    const manipuliert = { ...t, kdf: { ...t.kdf, runden: SCHNELL + 1 } };
    const s = await schluesselAusPasswort('richtiges Passwort', manipuliert.kdf);
    await expect(entschluesseln(JSON.stringify(manipuliert), s)).rejects.toThrow(TresorFehler);
  });

  it('lehnt Fremdes und Unsinniges ab', async () => {
    expect(() => leseTresor('kein json')).toThrow(TresorFehler);
    expect(() => leseTresor('{"schemaVersion":1}')).toThrow('Das ist kein Tresor des Finanz-Cockpits.');
    const zuTeuer = { format: 'finanz-cockpit-tresor', version: 1, kdf: { name: 'PBKDF2-SHA-256', runden: 1e12, salz: 'AAAA' }, iv: '', daten: '' };
    expect(() => leseTresor(JSON.stringify(zuTeuer))).toThrow('Die Schlüssel-Parameter des Tresors sind ungültig.');
    await expect(schluesselAusPasswort('', neueKdf(SCHNELL))).rejects.toThrow(TresorFehler);
  });

  it('prüft ein Passwort offline über den Prüfwert', async () => {
    const kdf = neueKdf(SCHNELL);
    const pruefwert = await pruefwertErzeugen(await schluesselAusPasswort('richtiges Passwort', kdf));
    expect(await pruefwertPasst(pruefwert, await schluesselAusPasswort('richtiges Passwort', kdf))).toBe(true);
    expect(await pruefwertPasst(pruefwert, await schluesselAusPasswort('richtiges Passwor', kdf))).toBe(false);
  });
});
