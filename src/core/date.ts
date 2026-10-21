/**
 * Kalenderdaten als ISO-Strings "YYYY-MM-DD". Gerechnet wird nur mit Jahr/Monat/Tag,
 * damit Zeitzonen und Sommerzeit keine Rolle spielen. ISO-Strings sind direkt vergleichbar.
 */
export type IsoDate = string;

export interface Ymd {
  y: number;
  m: number; // 1–12
  d: number;
}

export function parseIso(date: IsoDate): Ymd {
  const [y, m, d] = date.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

export function toIso({ y, m, d }: Ymd): IsoDate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { y, m, d } = parseIso(value);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Datum mit Tag im Monat; zu große Tage werden auf das Monatsende gesetzt (31. → 30.11.). */
export function clampedDate(y: number, m: number, day: number): IsoDate {
  return toIso({ y, m, d: Math.min(day, daysInMonth(y, m)) });
}

export function addMonths(y: number, m: number, months: number): { y: number; m: number } {
  const index = y * 12 + (m - 1) + months;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const { y, m, d } = parseIso(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toIso({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIso(from);
  const b = parseIso(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Anzahl ganzer Monatswechsel zwischen zwei Daten (Tage werden ignoriert). */
export function monthsBetween(from: IsoDate, to: IsoDate): number {
  const a = parseIso(from);
  const b = parseIso(to);
  return (b.y - a.y) * 12 + (b.m - a.m);
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b;
}

const shortFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const longFmt = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function asUtc(date: IsoDate): Date {
  const { y, m, d } = parseIso(date);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "24.10." */
export function formatShort(date: IsoDate): string {
  // de-DE liefert "24.10." bereits mit Schlusspunkt
  return shortFmt.format(asUtc(date));
}

/** "24.10.2026" */
export function formatLong(date: IsoDate): string {
  return longFmt.format(asUtc(date));
}

/** "Oktober 2026" */
export function formatMonth(date: IsoDate): string {
  return monthFmt.format(asUtc(date));
}
