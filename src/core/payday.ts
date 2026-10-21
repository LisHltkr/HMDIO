import { addMonths, clampedDate, parseIso, type IsoDate } from './date';

/** Gehaltstag im Monat, z. B. 28 oder 31 (= Monatsende). */
export type Gehaltstag = number;

/** Erster Gehaltstag strikt nach `today`. */
export function nextPayday(tag: Gehaltstag, today: IsoDate): IsoDate {
  const { y, m } = parseIso(today);
  const thisMonth = clampedDate(y, m, tag);
  if (thisMonth > today) return thisMonth;
  const next = addMonths(y, m, 1);
  return clampedDate(next.y, next.m, tag);
}

/** Letzter Gehaltstag bis einschließlich `today`. */
export function lastPayday(tag: Gehaltstag, today: IsoDate): IsoDate {
  const { y, m } = parseIso(today);
  const thisMonth = clampedDate(y, m, tag);
  if (thisMonth <= today) return thisMonth;
  const prev = addMonths(y, m, -1);
  return clampedDate(prev.y, prev.m, tag);
}
