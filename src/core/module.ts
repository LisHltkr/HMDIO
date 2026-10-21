import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { CashflowSource, KontoId } from './cashflow';
import type { IsoDate } from './date';
import type { Cents } from './money';

/** Gesamter gespeicherter Zustand: ein Bereich pro Modul. */
export interface AppData {
  schemaVersion: number;
  module: Record<string, unknown>;
}

export interface Seite {
  id: string;
  titel: string;
  /** Kleinere Zahl = weiter oben in der Navigation. */
  reihenfolge: number;
  Komponente: ComponentType;
}

/**
 * Ein Feature-Modul. Die App kennt nur diese Form; neue Module werden in
 * `app/modules.ts` eingetragen und bringen Daten, Seiten und Geldflüsse selbst mit.
 */
export interface FeatureModule<S = unknown> {
  id: string;
  daten?: {
    schema: z.ZodType<S>;
    initial: () => S;
  };
  seiten?: Seite[];
  cashflow?: CashflowSource<AppData>;
  /** Wohin die Differenz beim Kontoabgleich verbucht werden kann (z. B. auf ein Budget). */
  abgleichZiel?: AbgleichZiel;
}

export interface AbgleichZiel {
  optionen(data: AppData): { id: string; label: string }[];
  /** Verbucht `betrag` (positiv = fehlendes Geld) und gibt den neuen Zustand zurück. */
  verbuchen(
    data: AppData,
    p: { optionId: string; betrag: Cents; konto: KontoId; datum: IsoDate; zeitpunkt: string },
  ): AppData;
}

let registriert: FeatureModule[] = [];

/** Wird einmal beim Start von der App aufgerufen. */
export function registriereModule(module: FeatureModule[]): void {
  registriert = module;
}

export function alleModule(): FeatureModule[] {
  return registriert;
}

export function cashflowQuellen(): CashflowSource<AppData>[] {
  return registriert.flatMap((m) => (m.cashflow ? [m.cashflow] : []));
}

export function abgleichZiele(): AbgleichZiel[] {
  return registriert.flatMap((m) => (m.abgleichZiel ? [m.abgleichZiel] : []));
}

/** Liest den Datenbereich eines Moduls. Fehlt er, gelten die Startwerte des Moduls. */
export function slice<S>(data: AppData, modul: FeatureModule<S>): S {
  const value = data.module[modul.id];
  if (value === undefined) {
    if (!modul.daten) throw new Error(`Modul ${modul.id} hat keine Daten`);
    return modul.daten.initial();
  }
  return value as S;
}

export function withSlice<S>(data: AppData, modul: FeatureModule<S>, value: S): AppData {
  return { ...data, module: { ...data.module, [modul.id]: value } };
}

/** Kurze, ausreichend eindeutige IDs für Einträge. */
export function neueId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
