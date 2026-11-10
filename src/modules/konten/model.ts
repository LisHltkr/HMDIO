import { z } from 'zod';
import {
  cashflowQuellen,
  clampedDate,
  clock,
  formatShort,
  isIsoDate,
  parseIso,
  kontoAusblick,
  lastPayday,
  nextPayday,
  slice,
  store,
  useSlice,
  withSlice,
  type Abgleich,
  type FeatureModule,
  type AppData,
  type FinanzKontext,
  type IsoDate,
  type KontoAusblick,
  type KontoId,
} from '../../core';

export const KONTO_ARTEN = ['giro', 'spar', 'geldmarkt', 'depot'] as const;
export type KontoArt = (typeof KONTO_ARTEN)[number];

export const KONTO_ART_LABEL: Record<KontoArt, string> = {
  giro: 'Girokonto',
  spar: 'Sparkonto',
  geldmarkt: 'Geldmarktkonto',
  depot: 'Depot',
};

const isoDate = z.string().refine(isIsoDate, 'kein gültiges Datum');

const abgleichSchema = z.object({
  stand: z.number().int(),
  datum: isoDate,
  /** Leer, solange noch nie ein Stand eingetragen wurde. */
  zeitpunkt: z.string(),
  offen: z.array(z.string()),
  erledigt: z.array(z.string()),
});

const kontoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  art: z.enum(KONTO_ARTEN),
  abgleich: abgleichSchema,
});

export const kontenSchema = z.object({
  konten: z.array(kontoSchema),
  gehalt: z.object({
    tag: z.number().int().min(1).max(31),
    betrag: z.number().int().min(0),
    konto: z.string(),
  }),
});

export type Konto = z.infer<typeof kontoSchema>;
export type KontenDaten = z.infer<typeof kontenSchema>;

function neuerAbgleich(): Abgleich {
  return { stand: 0, datum: clock().heute(), zeitpunkt: '', offen: [], erledigt: [] };
}

export function neuesKonto(id: KontoId, name: string, art: KontoArt): Konto {
  return { id, name, art, abgleich: neuerAbgleich() };
}

export function initialeKonten(): KontenDaten {
  return {
    konten: [
      neuesKonto('giro', 'Girokonto', 'giro'),
      neuesKonto('spar', 'Sparkonto', 'spar'),
      neuesKonto('geldmarkt', 'Geldmarktkonto', 'geldmarkt'),
      neuesKonto('depot', 'Depot', 'depot'),
    ],
    gehalt: { tag: 1, betrag: 0, konto: 'giro' },
  };
}

export function istEingetragen(konto: Konto): boolean {
  return konto.abgleich.zeitpunkt !== '';
}

export function berechneKontext(daten: KontenDaten, heute: IsoDate): FinanzKontext {
  return {
    heute,
    naechsterGehaltstag: nextPayday(daten.gehalt.tag, heute),
    letzterGehaltstag: lastPayday(daten.gehalt.tag, heute),
  };
}

export function ausblickFuer(data: AppData, konto: Konto, kontext: FinanzKontext): KontoAusblick {
  return kontoAusblick(cashflowQuellen(), data, konto.id, konto.abgleich, kontext);
}

/** Daten-Teil des Moduls; Seiten kommen in index.ts dazu (vermeidet zirkuläre Importe). */
export const kontenBasis: FeatureModule<KontenDaten> = {
  id: 'konten',
  daten: { schema: kontenSchema, initial: initialeKonten },
};

export function kontenAus(data: AppData): KontenDaten {
  return slice(data, kontenBasis);
}

export function kontextAus(data: AppData): FinanzKontext {
  return berechneKontext(kontenAus(data), clock().heute());
}

export function useKonten(): KontenDaten {
  return useSlice(kontenBasis);
}

export function aktualisiereKonten(change: (d: KontenDaten) => KontenDaten): void {
  store().update(kontenBasis, change);
}

/**
 * Markiert einen Termin als noch offen, falls er auf oder vor dem letzten Abgleich liegt
 * (z. B. eine nachträglich eingetragene, noch unbezahlte Rechnung).
 */
export function alsOffenMarkieren(data: AppData, kontoId: KontoId, key: string, datum: IsoDate): AppData {
  const daten = kontenAus(data);
  return withSlice(data, kontenBasis, {
    ...daten,
    konten: daten.konten.map((k) =>
      k.id === kontoId && datum <= k.abgleich.datum && !k.abgleich.offen.includes(key)
        ? { ...k, abgleich: { ...k.abgleich, offen: [...k.abgleich.offen, key] } }
        : k,
    ),
  });
}

/**
 * Eingabe im Feld „Gehaltseingang am“ in einen Tag 1–31 übersetzen. Das Feld läuft rund:
 * „runter“ von 1 ergibt 0 → 31 (Monatsende), „hoch“ von 31 ergibt 32 → 1. Sonst null = ignorieren.
 */
export function gehaltstagAusEingabe(eingabe: number): number | null {
  if (!Number.isInteger(eingabe)) return null;
  if (eingabe === 0) return 31;
  if (eingabe === 32) return 1;
  return eingabe >= 1 && eingabe <= 31 ? eingabe : null;
}

/** Hinweis zum Gehaltstag; ab dem 29. mit dem echten Datum in diesem Monat (31 → „30.11.“). */
export function gehaltstagHinweis(tag: number, heute: IsoDate): string {
  if (tag < 29) return 'Tag im Monat; 31 = Monatsende';
  const { y, m } = parseIso(heute);
  return `Tag im Monat; 31 = Monatsende (diesen Monat: ${formatShort(clampedDate(y, m, tag))})`;
}
