import { describe, expect, it } from 'vitest';
import { kontoAusblick, type AppData } from '../../core';
import { budgetsAbgleichZiel, budgetsAus, budgetsCashflow, type BudgetsDaten } from './model';

const kontext = { heute: '2026-10-21', naechsterGehaltstag: '2026-10-31', letzterGehaltstag: '2026-09-30' };
const abgleich = { stand: 100000, datum: '2026-10-21', zeitpunkt: '2026-10-21T08:00:00Z', offen: [], erledigt: [] };

function daten(budgets: BudgetsDaten): AppData {
  return { schemaVersion: 1, module: { budgets } };
}

const basis: BudgetsDaten = {
  kategorien: [
    { id: 'essen', name: 'Essen', betrag: 45000, konto: 'giro' },
    { id: 'kleidung', name: 'Kleidung', betrag: 8000, konto: 'giro' },
  ],
  ausgaben: [
    { id: 'a', kategorie: 'essen', betrag: 27000, datum: '2026-10-10', konto: 'giro', erfasstAm: '2026-10-10T18:00:00Z' },
    { id: 'alt', kategorie: 'essen', betrag: 99900, datum: '2026-09-29', konto: 'giro', erfasstAm: '2026-09-29T18:00:00Z' },
  ],
};

describe('Budgets', () => {
  it('reserviert den Rest je Lebensbereich im Budgetmonat', () => {
    const a = kontoAusblick([budgetsCashflow], daten(basis), 'giro', abgleich, kontext);
    expect(a.reserviert).toBe(18000 + 8000);
    expect(a.verfuegbar).toBe(100000 - 26000);
  });

  it('eine Ausgabe innerhalb des Budgets ändert „verfügbar“ nicht, darüber hinaus schon', () => {
    const mit = (betrag: number) =>
      daten({
        ...basis,
        ausgaben: [...basis.ausgaben, { id: 'n', kategorie: 'kleidung', betrag, datum: '2026-10-21', konto: 'giro', erfasstAm: '2026-10-21T12:00:00Z' }],
      });
    const vorher = kontoAusblick([budgetsCashflow], daten(basis), 'giro', abgleich, kontext).verfuegbar;
    expect(kontoAusblick([budgetsCashflow], mit(5000), 'giro', abgleich, kontext).verfuegbar).toBe(vorher);
    expect(kontoAusblick([budgetsCashflow], mit(10000), 'giro', abgleich, kontext).verfuegbar).toBe(vorher - 2000);
  });

  it('verbucht die Abgleich-Differenz so, dass sie nicht doppelt zählt', () => {
    const neu = budgetsAbgleichZiel.verbuchen(daten(basis), {
      optionId: 'essen',
      betrag: 6000,
      konto: 'giro',
      datum: '2026-10-21',
      zeitpunkt: abgleich.zeitpunkt,
    });
    expect(budgetsAus(neu).ausgaben).toHaveLength(3);
    const a = kontoAusblick([budgetsCashflow], neu, 'giro', abgleich, kontext);
    expect(a.effektiverStand).toBe(100000);
    expect(a.reserviert).toBe(12000 + 8000);
  });
});
