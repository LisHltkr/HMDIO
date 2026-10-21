import { describe, expect, it } from 'vitest';
import { kontoAusblick, type AppData } from '../../core';
import { monatsBelastung, ruecklagenSoll, termineVon, zahlungenCashflow, type Posten } from './model';

const kfz: Posten = {
  id: 'kfz',
  name: 'Kfz-Versicherung',
  kategorie: 'Versicherungen',
  betrag: 64000,
  vonKonto: 'giro',
  rhythmus: 'jaehrlich',
  start: '2025-10-28',
  ruecklage: { konto: 'geldmarkt', vonKonto: 'giro', tag: 1, start: '2025-11-01' },
};
const miete: Posten = { id: 'miete', name: 'Miete', kategorie: 'Wohnen', betrag: 78000, vonKonto: 'giro', rhythmus: 'monatlich', start: '2026-01-01' };
const sparrate: Posten = { id: 'spar', name: 'Sparrate', kategorie: 'Sparen', betrag: 30000, vonKonto: 'giro', nachKonto: 'spar', rhythmus: 'monatlich', start: '2026-01-02' };
const etf: Posten = { id: 'etf', name: 'ETF-Sparplan', kategorie: 'Sparen', betrag: 15000, vonKonto: 'giro', nachKonto: 'depot', rhythmus: 'monatlich', start: '2026-01-15' };
const rundfunk: Posten = { id: 'rf', name: 'Rundfunkbeitrag', kategorie: 'Wohnen', betrag: 5508, vonKonto: 'giro', rhythmus: 'vierteljaehrlich', start: '2026-02-15' };

const data: AppData = { schemaVersion: 1, module: { zahlungen: { posten: [kfz, miete, sparrate, etf, rundfunk] } } };

describe('Rücklagen', () => {
  it('erzeugt monatliche Raten und den Ausgleich am Fälligkeitstag', () => {
    const t = termineVon(kfz, '2026-10-01', '2026-10-31');
    expect(t.map((x) => [x.art, x.datum, x.betrag, x.von, x.nach])).toEqual([
      ['fixkosten', '2026-10-28', 64000, 'giro', undefined],
      ['ruecklage', '2026-10-01', 5334, 'giro', 'geldmarkt'],
      ['ausgleich', '2026-10-28', 64000, 'geldmarkt', 'giro'],
    ]);
  });

  it('belastet das Giro netto nur mit der Monatsrate', () => {
    const abgleich = { stand: 100000, datum: '2026-10-20', zeitpunkt: 'x', offen: [], erledigt: [] };
    const kontext = { heute: '2026-10-21', naechsterGehaltstag: '2026-10-31', letzterGehaltstag: '2026-09-30' };
    const giro = kontoAusblick([zahlungenCashflow], data, 'giro', abgleich, kontext);
    expect(giro.abgaenge - giro.zugaenge).toBe(0);
    const gm = kontoAusblick([zahlungenCashflow], data, 'geldmarkt', { ...abgleich, stand: 70000 }, kontext);
    expect(gm.verfuegbar).toBe(6000);
  });

  it('berechnet den Soll-Stand der Rücklage', () => {
    const [stand] = ruecklagenSoll({ posten: [kfz] }, 'geldmarkt', '2027-09-15');
    expect(stand?.naechsteFaelligkeit).toBe('2027-10-28');
    expect(stand?.soll).toBe(64000 - 5334);
    expect(ruecklagenSoll({ posten: [kfz] }, 'geldmarkt', '2026-10-29')[0]?.soll).toBe(0);
  });
});

describe('monatsBelastung', () => {
  it('trennt Fixkosten, Rücklagen und Sparen', () => {
    expect(monatsBelastung({ posten: [kfz, miete, sparrate, etf, rundfunk] }, 'giro')).toEqual({
      fixkosten: 78000 + 1836,
      ruecklagen: 5334,
      sparen: 45000,
    });
  });
});
