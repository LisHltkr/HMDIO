import { toIso, type IsoDate } from './date';

export interface Clock {
  /** Heutiges Datum in lokaler Zeit. */
  heute(): IsoDate;
  /** Aktueller Zeitpunkt als ISO-Zeitstempel. */
  jetzt(): string;
}

export const systemClock: Clock = {
  heute() {
    const d = new Date();
    return toIso({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
  },
  jetzt() {
    return new Date().toISOString();
  },
};

let current: Clock = systemClock;

export function clock(): Clock {
  return current;
}

/** Für Tests: eine feste Uhr setzen. */
export function setClock(c: Clock): void {
  current = c;
}
