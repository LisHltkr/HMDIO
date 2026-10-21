import { addDays, minDate, type IsoDate } from './date';
import { sum, type Cents } from './money';

export type KontoId = string;

/** Ein konkretes Vorkommen eines Postens an einem Datum. */
export interface Termin {
  /** Eindeutig und stabil: `<quelle>:<postenId>:<datum>` */
  key: string;
  quelle: string;
  datum: IsoDate;
  /** Immer positiv. Richtung ergibt sich aus `von`/`nach`. */
  betrag: Cents;
  von?: KontoId;
  nach?: KontoId;
  bezeichnung: string;
  /** Freie Art zur Anzeige, z. B. "fixkosten", "rechnung", "umbuchung". */
  art: string;
  kategorie?: string;
}

/** Geld, das auf einem Konto für etwas zurückgehalten wird, ohne festes Datum (z. B. Restbudget). */
export interface Reservierung {
  quelle: string;
  konto: KontoId;
  betrag: Cents;
  bezeichnung: string;
}

/** Eine bereits getätigte Ausgabe, die den Kontostand schon verringert hat. */
export interface Buchung {
  id: string;
  konto: KontoId;
  /** Positiv = Abgang. */
  betrag: Cents;
  /** ISO-Zeitstempel der Erfassung. */
  erfasstAm: string;
}

/** Zeitlicher Rahmen der Rechnung, abgeleitet aus heute und dem Gehaltstag. */
export interface FinanzKontext {
  heute: IsoDate;
  naechsterGehaltstag: IsoDate;
  letzterGehaltstag: IsoDate;
}

/**
 * Port, über den Module ihre Geldflüsse melden. Neue Module (z. B. Kredite)
 * fließen so automatisch in die Rechnung ein.
 */
export interface CashflowSource<D = unknown> {
  id: string;
  /** Alle Termine mit Datum in [from, to]. */
  termine?(data: D, from: IsoDate, to: IsoDate): Termin[];
  reservierungen?(data: D, kontext: FinanzKontext): Reservierung[];
  buchungen?(data: D): Buchung[];
}

/** Letzter von Hand eingetragener Kontostand. */
export interface Abgleich {
  stand: Cents;
  /** Termine bis einschließlich diesem Datum gelten als im Stand enthalten … */
  datum: IsoDate;
  /** Zeitpunkt der Eingabe; Buchungen danach sind noch nicht im Stand enthalten. */
  zeitpunkt: string;
  /** … außer diese Termin-Keys, die noch nicht abgegangen sind. */
  offen: string[];
  /** Termin-Keys nach `datum`, die schon vorzeitig abgegangen sind. */
  erledigt: string[];
}

export function terminDatumAusKey(key: string): IsoDate {
  return key.slice(key.lastIndexOf(':') + 1);
}

/** Wirkung eines Termins auf ein Konto: negativ = Abgang, positiv = Zugang, 0 = betrifft das Konto nicht. */
export function wirkung(termin: Termin, konto: KontoId): Cents {
  if (termin.von === konto) return -termin.betrag;
  if (termin.nach === konto) return termin.betrag;
  return 0;
}

function sammleTermine<D>(sources: CashflowSource<D>[], data: D, from: IsoDate, to: IsoDate): Termin[] {
  if (from > to) return [];
  return sources
    .flatMap((s) => s.termine?.(data, from, to) ?? [])
    .sort((a, b) => (a.datum === b.datum ? a.bezeichnung.localeCompare(b.bezeichnung) : a.datum < b.datum ? -1 : 1));
}

function fruehestesOffenesDatum(abgleich: Abgleich, fallback: IsoDate): IsoDate {
  return abgleich.offen.reduce((min, key) => minDate(min, terminDatumAusKey(key)), fallback);
}

/**
 * Termine, die ein Konto betreffen, nach dem Abgleich liegen (oder noch offen sind)
 * und vor `bisExklusiv` fällig werden.
 */
export function ausstehendeTermine<D>(
  sources: CashflowSource<D>[],
  data: D,
  konto: KontoId,
  abgleich: Abgleich,
  bisExklusiv: IsoDate,
): Termin[] {
  const nachAbgleich = addDays(abgleich.datum, 1);
  const from = fruehestesOffenesDatum(abgleich, nachAbgleich);
  const offen = new Set(abgleich.offen);
  const erledigt = new Set(abgleich.erledigt);
  return sammleTermine(sources, data, from, addDays(bisExklusiv, -1)).filter(
    (t) => wirkung(t, konto) !== 0 && !erledigt.has(t.key) && (t.datum >= nachAbgleich || offen.has(t.key)),
  );
}

/** Termine, die beim Abgleich am Tag `heute` abgefragt werden: seit dem letzten Abgleich fällig oder noch offen. */
export function abgleichKandidaten<D>(
  sources: CashflowSource<D>[],
  data: D,
  konto: KontoId,
  abgleich: Abgleich,
  heute: IsoDate,
): Termin[] {
  return ausstehendeTermine(sources, data, konto, abgleich, addDays(heute, 1));
}

export interface KontoAusblick {
  /** Eingetragener Stand minus seither erfasster Ausgaben. */
  effektiverStand: Cents;
  ausstehend: Termin[];
  abgaenge: Cents;
  zugaenge: Cents;
  reservierungen: Reservierung[];
  reserviert: Cents;
  /** effektiverStand − abgaenge + zugaenge − reserviert */
  verfuegbar: Cents;
}

export function kontoAusblick<D>(
  sources: CashflowSource<D>[],
  data: D,
  konto: KontoId,
  abgleich: Abgleich,
  kontext: FinanzKontext,
): KontoAusblick {
  const spaetereBuchungen = sources
    .flatMap((s) => s.buchungen?.(data) ?? [])
    .filter((b) => b.konto === konto && b.erfasstAm > abgleich.zeitpunkt);
  const effektiverStand = abgleich.stand - sum(spaetereBuchungen.map((b) => b.betrag));

  const ausstehend = ausstehendeTermine(sources, data, konto, abgleich, kontext.naechsterGehaltstag);
  const abgaenge = -sum(ausstehend.map((t) => Math.min(0, wirkung(t, konto))));
  const zugaenge = sum(ausstehend.map((t) => Math.max(0, wirkung(t, konto))));

  const reservierungen = sources
    .flatMap((s) => s.reservierungen?.(data, kontext) ?? [])
    .filter((r) => r.konto === konto && r.betrag > 0);
  const reserviert = sum(reservierungen.map((r) => r.betrag));

  return {
    effektiverStand,
    ausstehend,
    abgaenge,
    zugaenge,
    reservierungen,
    reserviert,
    verfuegbar: effektiverStand - abgaenge + zugaenge - reserviert,
  };
}

/**
 * Ergebnis eines Abgleichs. `termine` sind alle im Dialog gezeigten Termine (fällige und
 * kommende), `abgegangen` die abgehakten. Die Differenz zwischen erwartetem und eingegebenem
 * Stand ist negativ, wenn Geld fehlt – also Ausgaben, die noch nicht erfasst sind.
 */
export function abgleichen(
  vorher: Abgleich,
  termine: Termin[],
  abgegangen: Set<string>,
  konto: KontoId,
  effektiverStand: Cents,
  neuerStand: Cents,
  heute: IsoDate,
  zeitpunkt: string,
): { abgleich: Abgleich; erwartet: Cents; differenz: Cents } {
  const erwartet = effektiverStand + sum(termine.filter((t) => abgegangen.has(t.key)).map((t) => wirkung(t, konto)));
  const nochKommend = (key: string) => terminDatumAusKey(key) > heute;
  const erledigt = new Set(vorher.erledigt.filter(nochKommend));
  for (const t of termine) if (abgegangen.has(t.key) && t.datum > heute) erledigt.add(t.key);
  return {
    abgleich: {
      stand: neuerStand,
      datum: heute,
      zeitpunkt,
      offen: termine.filter((t) => t.datum <= heute && !abgegangen.has(t.key)).map((t) => t.key),
      erledigt: [...erledigt],
    },
    erwartet,
    differenz: neuerStand - erwartet,
  };
}
