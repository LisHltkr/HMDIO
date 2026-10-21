/** Geldbeträge sind immer ganzzahlige Cent, um Rundungsfehler zu vermeiden. */
export type Cents = number;

const formatter = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function formatEuro(cents: Cents): string {
  return formatter.format(cents / 100);
}

/** Wie formatEuro, aber mit explizitem Vorzeichen (+/−). */
export function formatSigned(cents: Cents): string {
  if (cents === 0) return formatEuro(0);
  return (cents > 0 ? '+' : '−') + formatEuro(Math.abs(cents));
}

/** Formatiert Cent für ein Eingabefeld, z. B. 123456 → "1234,56". */
export function toInputValue(cents: Cents): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Liest deutsche Eingaben wie "1.234,56", "12,5", "-80" oder "12.50".
 * Gibt null zurück, wenn die Eingabe kein Betrag ist.
 */
export function parseEuro(input: string): Cents | null {
  let s = input.trim().replace(/€/g, '').replace(/\s/g, '').replace('−', '-');
  if (s === '') return null;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" ist ein Tausenderpunkt, kein Dezimalpunkt
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function sum(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}
