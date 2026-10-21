import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  abgleichKandidaten,
  abgleichen,
  ausstehendeTermine,
  kontoAusblick,
  type Abgleich,
  type CashflowSource,
  type FinanzKontext,
  type Termin,
} from './cashflow';
import { occurrencesBetween, type Wiederholung } from './recurrence';
import { DatenFehler, leereDaten, parseAppData, serializeAppData } from './persistence';
import type { FeatureModule } from './module';

interface Posten {
  id: string;
  betrag: number;
  von: string;
  nach?: string;
  w: Wiederholung;
}

function quelle(posten: Posten[], extra: Partial<CashflowSource<null>> = {}): CashflowSource<null> {
  return {
    id: 'test',
    termine: (_d, from, to) =>
      posten.flatMap((p) =>
        occurrencesBetween(p.w, from, to).map(
          (datum): Termin => ({
            key: `test:${p.id}:${datum}`,
            quelle: 'test',
            datum,
            betrag: p.betrag,
            von: p.von,
            nach: p.nach,
            bezeichnung: p.id,
            art: 'fixkosten',
          }),
        ),
      ),
    ...extra,
  };
}

const kontext: FinanzKontext = { heute: '2026-10-21', naechsterGehaltstag: '2026-10-31', letzterGehaltstag: '2026-09-30' };
const abgleich: Abgleich = { stand: 248000, datum: '2026-10-21', zeitpunkt: '2026-10-21T08:30:00Z', offen: [], erledigt: [] };

const posten: Posten[] = [
  { id: 'strom', betrag: 8500, von: 'giro', w: { rhythmus: 'monatlich', start: '2026-01-24' } },
  { id: 'miete', betrag: 78000, von: 'giro', w: { rhythmus: 'monatlich', start: '2026-01-01' } },
  { id: 'sparrate', betrag: 30000, von: 'giro', nach: 'spar', w: { rhythmus: 'monatlich', start: '2026-01-30' } },
  { id: 'zahnarzt', betrag: 15000, von: 'giro', w: { rhythmus: 'einmalig', start: '2026-10-29' } },
  { id: 'heute', betrag: 1000, von: 'giro', w: { rhythmus: 'einmalig', start: '2026-10-21' } },
  { id: 'gehaltstag', betrag: 2000, von: 'giro', w: { rhythmus: 'einmalig', start: '2026-10-31' } },
];

describe('kontoAusblick', () => {
  it('zieht nur Termine nach dem Abgleich und vor dem Gehaltstag ab', () => {
    const a = kontoAusblick([quelle(posten)], null, 'giro', abgleich, kontext);
    expect(a.ausstehend.map((t) => t.bezeichnung)).toEqual(['strom', 'zahnarzt', 'sparrate']);
    expect(a.abgaenge).toBe(8500 + 15000 + 30000);
    expect(a.verfuegbar).toBe(248000 - 53500);
  });

  it('zählt Umbuchungen auf dem Zielkonto als Zugang', () => {
    const a = kontoAusblick([quelle(posten)], null, 'spar', { ...abgleich, stand: 420000 }, kontext);
    expect(a.zugaenge).toBe(30000);
    expect(a.verfuegbar).toBe(450000);
  });

  it('berücksichtigt offene, vorzeitig erledigte, Reservierungen und spätere Buchungen', () => {
    const src = quelle(posten, {
      reservierungen: () => [{ quelle: 'test', konto: 'giro', betrag: 33000, bezeichnung: 'Budgets' }],
      buchungen: () => [
        { id: 'a', konto: 'giro', betrag: 4000, erfasstAm: '2026-10-21T12:00:00Z' },
        { id: 'b', konto: 'giro', betrag: 9999, erfasstAm: '2026-10-21T07:00:00Z' },
      ],
    });
    const a = kontoAusblick(
      [src],
      null,
      'giro',
      { ...abgleich, offen: ['test:heute:2026-10-21'], erledigt: ['test:strom:2026-10-24'] },
      kontext,
    );
    expect(a.ausstehend.map((t) => t.bezeichnung)).toEqual(['heute', 'zahnarzt', 'sparrate']);
    expect(a.effektiverStand).toBe(244000);
    expect(a.verfuegbar).toBe(244000 - 1000 - 15000 - 30000 - 33000);
  });
});

describe('abgleichen', () => {
  it('übernimmt nicht abgehakte Termine als offen und berechnet die Differenz', () => {
    const src = [quelle(posten)];
    const heute = '2026-10-26';
    const kandidaten = abgleichKandidaten(src, null, 'giro', abgleich, heute);
    expect(kandidaten.map((t) => t.key)).toEqual(['test:strom:2026-10-24']);

    const kommend = ausstehendeTermine(src, null, 'giro', abgleich, '2026-10-31').filter((t) => t.datum > heute);
    const ergebnis = abgleichen(
      abgleich,
      [...kandidaten, ...kommend],
      new Set(['test:zahnarzt:2026-10-29']),
      'giro',
      248000,
      225000,
      heute,
      '2026-10-26T09:00:00Z',
    );
    expect(ergebnis.erwartet).toBe(248000 - 15000);
    expect(ergebnis.differenz).toBe(225000 - 233000);
    expect(ergebnis.abgleich.offen).toEqual(['test:strom:2026-10-24']);
    expect(ergebnis.abgleich.erledigt).toEqual(['test:zahnarzt:2026-10-29']);

    const danach = kontoAusblick(src, null, 'giro', ergebnis.abgleich, { ...kontext, heute });
    expect(danach.ausstehend.map((t) => t.bezeichnung)).toEqual(['strom', 'sparrate']);
  });
});

describe('persistence', () => {
  const modul: FeatureModule<{ n: number }> = {
    id: 'demo',
    daten: { schema: z.object({ n: z.number() }), initial: () => ({ n: 1 }) },
  };

  it('ergänzt fehlende Bereiche und behält unbekannte', () => {
    const data = parseAppData('{"schemaVersion":1,"module":{"fremd":{"x":1}}}', [modul]);
    expect(data.module).toEqual({ fremd: { x: 1 }, demo: { n: 1 } });
    expect(parseAppData(serializeAppData(leereDaten([modul])), [modul]).module.demo).toEqual({ n: 1 });
  });

  it('meldet ungültige Daten statt sie zu verwerfen', () => {
    expect(() => parseAppData('{"schemaVersion":1,"module":{"demo":{"n":"x"}}}', [modul])).toThrow(DatenFehler);
    expect(() => parseAppData('kaputt', [modul])).toThrow(DatenFehler);
    expect(() => parseAppData('{"schemaVersion":99,"module":{}}', [modul])).toThrow(/neueren Version/);
  });
});
