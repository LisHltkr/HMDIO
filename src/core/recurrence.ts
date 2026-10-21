import { addMonths, clampedDate, parseIso, type IsoDate } from './date';

export const RHYTHMEN = ['einmalig', 'monatlich', 'vierteljaehrlich', 'halbjaehrlich', 'jaehrlich'] as const;
export type Rhythmus = (typeof RHYTHMEN)[number];

export const RHYTHMUS_LABEL: Record<Rhythmus, string> = {
  einmalig: 'einmalig',
  monatlich: 'monatlich',
  vierteljaehrlich: 'vierteljährlich',
  halbjaehrlich: 'halbjährlich',
  jaehrlich: 'jährlich',
};

/** Abstand zwischen zwei Terminen in Monaten; 0 bei einmalig. */
export function intervalMonths(rhythmus: Rhythmus): number {
  switch (rhythmus) {
    case 'einmalig':
      return 0;
    case 'monatlich':
      return 1;
    case 'vierteljaehrlich':
      return 3;
    case 'halbjaehrlich':
      return 6;
    case 'jaehrlich':
      return 12;
  }
}

export interface Wiederholung {
  rhythmus: Rhythmus;
  /** Erster Termin. Der Tag im Monat gilt für alle Folgetermine (mit Monatsende-Clamp). */
  start: IsoDate;
  /** Letzter möglicher Termin (inklusive), optional. */
  ende?: IsoDate;
}

/**
 * Alle Termine einer Wiederholung im Bereich [from, to] (beide inklusive), aufsteigend.
 */
export function occurrencesBetween(w: Wiederholung, from: IsoDate, to: IsoDate): IsoDate[] {
  const last = w.ende && w.ende < to ? w.ende : to;
  if (w.rhythmus === 'einmalig') {
    return w.start >= from && w.start <= last ? [w.start] : [];
  }
  const step = intervalMonths(w.rhythmus);
  const start = parseIso(w.start);
  const result: IsoDate[] = [];
  // Zum ersten Termin ≥ from springen, statt ab start alle Monate abzulaufen.
  const fromYmd = parseIso(from);
  const monthsToFrom = (fromYmd.y - start.y) * 12 + (fromYmd.m - start.m);
  let k = Math.max(0, Math.floor(monthsToFrom / step) - 1);
  for (;;) {
    const { y, m } = addMonths(start.y, start.m, k * step);
    const date = clampedDate(y, m, start.d);
    if (date > last) break;
    if (date >= from) result.push(date);
    k++;
  }
  return result;
}

/** Monatlicher Gegenwert eines Betrags, aufgerundet auf ganze Cent. */
export function monthlyEquivalent(betrag: number, rhythmus: Rhythmus): number {
  const months = intervalMonths(rhythmus);
  return months === 0 ? 0 : Math.ceil(betrag / months);
}
