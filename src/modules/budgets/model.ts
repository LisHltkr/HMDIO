import { z } from 'zod';
import {
  isIsoDate,
  neueId,
  slice,
  store,
  sum,
  useSlice,
  withSlice,
  type AbgleichZiel,
  type AppData,
  type CashflowSource,
  type Cents,
  type FeatureModule,
  type FinanzKontext,
} from '../../core';

const QUELLE = 'budgets';
const isoDate = z.string().refine(isIsoDate, 'kein gültiges Datum');

const kategorieSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Geplanter Betrag pro Gehaltsmonat. */
  betrag: z.number().int().min(0),
  /** Konto, von dem in diesem Lebensbereich bezahlt wird. */
  konto: z.string(),
});

const ausgabeSchema = z.object({
  id: z.string().min(1),
  kategorie: z.string(),
  betrag: z.number().int().positive(),
  datum: isoDate,
  konto: z.string(),
  notiz: z.string().optional(),
  /** Zeitpunkt der Erfassung; entscheidet, ob die Ausgabe schon im Kontostand steckt. */
  erfasstAm: z.string(),
});

export const budgetsSchema = z.object({
  kategorien: z.array(kategorieSchema),
  ausgaben: z.array(ausgabeSchema),
});

export type Kategorie = z.infer<typeof kategorieSchema>;
export type Ausgabe = z.infer<typeof ausgabeSchema>;
export type BudgetsDaten = z.infer<typeof budgetsSchema>;

export function initialeBudgets(): BudgetsDaten {
  const namen = ['Essen & Lebensmittel', 'Tanken', 'Freizeit', 'Kleidung', 'Drogerie', 'Geschenke'];
  return {
    kategorien: namen.map((name) => ({ id: neueId(), name, betrag: 0, konto: 'giro' })),
    ausgaben: [],
  };
}

export interface BudgetStand {
  kategorie: Kategorie;
  ausgegeben: Cents;
  rest: Cents;
  ausgaben: Ausgabe[];
}

/** Stand je Lebensbereich im Budgetzeitraum [letzter Gehaltstag, nächster Gehaltstag). */
export function budgetStaende(daten: BudgetsDaten, kontext: FinanzKontext): BudgetStand[] {
  const imZeitraum = daten.ausgaben.filter((a) => a.datum >= kontext.letzterGehaltstag && a.datum < kontext.naechsterGehaltstag);
  return daten.kategorien.map((kategorie) => {
    const ausgaben = imZeitraum.filter((a) => a.kategorie === kategorie.id);
    const ausgegeben = sum(ausgaben.map((a) => a.betrag));
    return { kategorie, ausgegeben, rest: Math.max(0, kategorie.betrag - ausgegeben), ausgaben };
  });
}

export function neueAusgabe(daten: BudgetsDaten, a: Omit<Ausgabe, 'id'>): BudgetsDaten {
  return { ...daten, ausgaben: [...daten.ausgaben, { ...a, id: neueId() }] };
}

export const budgetsBasis: FeatureModule<BudgetsDaten> = {
  id: 'budgets',
  daten: { schema: budgetsSchema, initial: initialeBudgets },
};

export function budgetsAus(data: AppData): BudgetsDaten {
  return slice(data, budgetsBasis);
}

export const budgetsCashflow: CashflowSource<AppData> = {
  id: QUELLE,
  reservierungen: (data, kontext) =>
    budgetStaende(budgetsAus(data), kontext).map((s) => ({
      quelle: QUELLE,
      konto: s.kategorie.konto,
      betrag: s.rest,
      bezeichnung: s.kategorie.name,
    })),
  buchungen: (data) => budgetsAus(data).ausgaben.map((a) => ({ id: a.id, konto: a.konto, betrag: a.betrag, erfasstAm: a.erfasstAm })),
};

/** Beim Kontoabgleich kann eine Differenz als Ausgabe in einem Lebensbereich verbucht werden. */
export const budgetsAbgleichZiel: AbgleichZiel = {
  optionen: (data) => budgetsAus(data).kategorien.map((k) => ({ id: k.id, label: k.name })),
  verbuchen: (data, p) =>
    withSlice(
      data,
      budgetsBasis,
      neueAusgabe(budgetsAus(data), {
        kategorie: p.optionId,
        betrag: p.betrag,
        datum: p.datum,
        konto: p.konto,
        notiz: 'Differenz aus Kontoabgleich',
        erfasstAm: p.zeitpunkt,
      }),
    ),
};

export function useBudgets(): BudgetsDaten {
  return useSlice(budgetsBasis);
}

export function aktualisiereBudgets(change: (d: BudgetsDaten) => BudgetsDaten): void {
  store().update(budgetsBasis, change);
}
