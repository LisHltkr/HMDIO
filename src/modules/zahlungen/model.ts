import { z } from 'zod';
import {
  RHYTHMEN,
  addMonths,
  clampedDate,
  intervalMonths,
  isIsoDate,
  monthlyEquivalent,
  monthsBetween,
  occurrencesBetween,
  parseIso,
  slice,
  store,
  sum,
  useSlice,
  type AppData,
  type Cents,
  type CashflowSource,
  type FeatureModule,
  type IsoDate,
  type KontoId,
  type Termin,
  type Wiederholung,
} from '../../core';

const QUELLE = 'zahlungen';
const isoDate = z.string().refine(isIsoDate, 'kein gültiges Datum');

const ruecklageSchema = z.object({
  /** Konto, auf dem die Rücklage gesammelt wird (z. B. Geldmarkt). */
  konto: z.string(),
  /** Konto, von dem die monatliche Rate abgeht (z. B. Giro). */
  vonKonto: z.string(),
  /** Tag im Monat der Rate. */
  tag: z.number().int().min(1).max(31),
  /** Erste Rate. */
  start: isoDate,
});

const postenSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kategorie: z.string(),
  betrag: z.number().int().positive(),
  vonKonto: z.string(),
  /** Gesetzt = Umbuchung auf ein eigenes Konto (Sparrate, Sparplan). */
  nachKonto: z.string().optional(),
  rhythmus: z.enum(RHYTHMEN),
  start: isoDate,
  ende: isoDate.optional(),
  ruecklage: ruecklageSchema.optional(),
});

export const zahlungenSchema = z.object({ posten: z.array(postenSchema) });

export type Posten = z.infer<typeof postenSchema>;
export type Ruecklage = z.infer<typeof ruecklageSchema>;
export type ZahlungenDaten = z.infer<typeof zahlungenSchema>;

export type PostenArt = 'fixkosten' | 'rechnung' | 'umbuchung';

export function postenArt(p: Posten): PostenArt {
  if (p.nachKonto) return 'umbuchung';
  return p.rhythmus === 'einmalig' ? 'rechnung' : 'fixkosten';
}

export const ART_LABEL: Record<string, string> = {
  fixkosten: 'Fixkosten',
  rechnung: 'Rechnung',
  umbuchung: 'Umbuchung',
  ruecklage: 'Rücklage',
  ausgleich: 'Ausgleich aus Rücklage',
};

/** Rücklagen sind nur bei seltener als monatlich fälligen Kosten sinnvoll. */
export function kannRuecklage(p: Pick<Posten, 'rhythmus' | 'nachKonto'>): boolean {
  return !p.nachKonto && intervalMonths(p.rhythmus) > 1;
}

export function terminKey(postenId: string, datum: IsoDate): string {
  return `${QUELLE}:${postenId}:${datum}`;
}

function wiederholung(p: Posten): Wiederholung {
  return { rhythmus: p.rhythmus, start: p.start, ende: p.ende };
}

function ruecklagenWiederholung(p: Posten, r: Ruecklage): Wiederholung {
  const { y, m } = parseIso(r.start);
  return { rhythmus: 'monatlich', start: clampedDate(y, m, r.tag), ende: p.ende };
}

/** Alle Termine eines Postens im Bereich, inklusive Rücklage-Raten und Ausgleich. */
export function termineVon(p: Posten, from: IsoDate, to: IsoDate): Termin[] {
  const termine: Termin[] = [];
  const faellig = occurrencesBetween(wiederholung(p), from, to);
  for (const datum of faellig) {
    termine.push({
      key: terminKey(p.id, datum),
      quelle: QUELLE,
      datum,
      betrag: p.betrag,
      von: p.vonKonto,
      nach: p.nachKonto,
      bezeichnung: p.name,
      art: postenArt(p),
      kategorie: p.kategorie,
    });
  }

  const r = p.ruecklage;
  if (r && kannRuecklage(p)) {
    const rate = monthlyEquivalent(p.betrag, p.rhythmus);
    for (const datum of occurrencesBetween(ruecklagenWiederholung(p, r), from, to)) {
      termine.push({
        key: terminKey(`${p.id}-ruecklage`, datum),
        quelle: QUELLE,
        datum,
        betrag: rate,
        von: r.vonKonto,
        nach: r.konto,
        bezeichnung: `Rücklage ${p.name}`,
        art: 'ruecklage',
        kategorie: p.kategorie,
      });
    }
    // Wird die Rechnung von einem anderen Konto bezahlt, kommt das Geld am Fälligkeitstag zurück.
    if (r.konto !== p.vonKonto) {
      for (const datum of faellig) {
        termine.push({
          key: terminKey(`${p.id}-ausgleich`, datum),
          quelle: QUELLE,
          datum,
          betrag: p.betrag,
          von: r.konto,
          nach: p.vonKonto,
          bezeichnung: `Ausgleich aus Rücklage: ${p.name}`,
          art: 'ausgleich',
          kategorie: p.kategorie,
        });
      }
    }
  }
  return termine;
}

export function naechsterTermin(p: Posten, heute: IsoDate): IsoDate | null {
  const bis = addMonths(parseIso(heute).y, parseIso(heute).m, Math.max(12, intervalMonths(p.rhythmus)) + 1);
  return occurrencesBetween(wiederholung(p), heute, clampedDate(bis.y, bis.m, 31))[0] ?? null;
}

/** Monatliche Belastung eines Kontos durch wiederkehrende Posten (ohne einmalige Rechnungen). */
export interface MonatsBelastung {
  /** Monatliche Fixkosten plus Monatsanteil seltener Kosten ohne Rücklage. */
  fixkosten: Cents;
  /** Monatliche Raten in Rücklagen. */
  ruecklagen: Cents;
  /** Umbuchungen auf eigene Konten (Sparraten, Sparplan). */
  sparen: Cents;
}

export function monatsBelastung(daten: ZahlungenDaten, konto: KontoId): MonatsBelastung {
  const wiederkehrend = daten.posten.filter((p) => p.rhythmus !== 'einmalig');
  const mitRuecklage = (p: Posten) => !!p.ruecklage && kannRuecklage(p);
  return {
    fixkosten: sum(
      wiederkehrend
        .filter((p) => p.vonKonto === konto && !p.nachKonto && !mitRuecklage(p))
        .map((p) => monthlyEquivalent(p.betrag, p.rhythmus)),
    ),
    ruecklagen: sum(
      wiederkehrend.filter((p) => mitRuecklage(p) && p.ruecklage!.vonKonto === konto).map((p) => monthlyEquivalent(p.betrag, p.rhythmus)),
    ),
    sparen: sum(
      wiederkehrend.filter((p) => p.vonKonto === konto && p.nachKonto).map((p) => monthlyEquivalent(p.betrag, p.rhythmus)),
    ),
  };
}

export interface RuecklagenStand {
  posten: Posten;
  /** Was zum heutigen Tag angespart sein sollte. */
  soll: Cents;
  naechsteFaelligkeit: IsoDate | null;
}

/**
 * Soll-Stand je Rücklage: Anteil der bis zur nächsten Fälligkeit noch fehlenden Raten
 * wird vom Betrag abgezogen.
 */
export function ruecklagenSoll(daten: ZahlungenDaten, konto: KontoId, heute: IsoDate): RuecklagenStand[] {
  return daten.posten
    .filter((p) => p.ruecklage && kannRuecklage(p) && p.ruecklage.konto === konto)
    .map((p) => {
      const naechste = naechsterTermin(p, heute);
      const intervall = intervalMonths(p.rhythmus);
      const rate = monthlyEquivalent(p.betrag, p.rhythmus);
      const restRaten = naechste ? Math.min(intervall, Math.max(0, monthsBetween(heute, naechste))) : intervall;
      return { posten: p, soll: Math.max(0, p.betrag - restRaten * rate), naechsteFaelligkeit: naechste };
    });
}

export const zahlungenCashflow: CashflowSource<AppData> = {
  id: QUELLE,
  termine: (data, from, to) => zahlungenAus(data).posten.flatMap((p) => termineVon(p, from, to)),
};

export const zahlungenBasis: FeatureModule<ZahlungenDaten> = {
  id: 'zahlungen',
  daten: { schema: zahlungenSchema, initial: () => ({ posten: [] }) },
  cashflow: zahlungenCashflow,
};

export function zahlungenAus(data: AppData): ZahlungenDaten {
  return slice(data, zahlungenBasis);
}

export function useZahlungen(): ZahlungenDaten {
  return useSlice(zahlungenBasis);
}

export function aktualisiereZahlungen(change: (d: ZahlungenDaten) => ZahlungenDaten): void {
  store().update(zahlungenBasis, change);
}

/** Was monatlich regelmäßig auf ein Konto fließt (Sparraten, Sparplan, Rücklage-Raten). */
export function monatlicheZufluesse(daten: ZahlungenDaten, konto: KontoId): Cents {
  const wiederkehrend = daten.posten.filter((p) => p.rhythmus !== 'einmalig');
  return sum([
    ...wiederkehrend.filter((p) => p.nachKonto === konto).map((p) => monthlyEquivalent(p.betrag, p.rhythmus)),
    ...wiederkehrend
      .filter((p) => p.ruecklage && kannRuecklage(p) && p.ruecklage.konto === konto)
      .map((p) => monthlyEquivalent(p.betrag, p.rhythmus)),
  ]);
}
