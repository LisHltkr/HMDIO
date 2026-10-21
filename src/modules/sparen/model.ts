import { z } from 'zod';
import { addMonths, clampedDate, neueId, parseIso, slice, store, useSlice, type AppData, type Cents, type FeatureModule, type IsoDate } from '../../core';

const zielSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Konto, auf dem für das Ziel gespart wird. */
  konto: z.string(),
  zielBetrag: z.number().int().min(0),
});

export const sparenSchema = z.object({ ziele: z.array(zielSchema) });

export type Sparziel = z.infer<typeof zielSchema>;
export type SparenDaten = z.infer<typeof sparenSchema>;

export const sparenBasis: FeatureModule<SparenDaten> = {
  id: 'sparen',
  daten: { schema: sparenSchema, initial: () => ({ ziele: [{ id: neueId(), name: 'Puffer', konto: 'spar', zielBetrag: 0 }] }) },
};

export function sparenAus(data: AppData): SparenDaten {
  return slice(data, sparenBasis);
}

export function useSparen(): SparenDaten {
  return useSlice(sparenBasis);
}

export function aktualisiereSparen(change: (d: SparenDaten) => SparenDaten): void {
  store().update(sparenBasis, change);
}

/** Monat, in dem das Ziel bei gleichbleibender Rate erreicht wird; null wenn nie. */
export function zielErreichtIm(stand: Cents, ziel: Cents, rateProMonat: Cents, heute: IsoDate): IsoDate | null | 'erreicht' {
  if (stand >= ziel) return 'erreicht';
  if (rateProMonat <= 0) return null;
  const monate = Math.ceil((ziel - stand) / rateProMonat);
  const { y, m } = parseIso(heute);
  const t = addMonths(y, m, monate);
  return clampedDate(t.y, t.m, 1);
}
