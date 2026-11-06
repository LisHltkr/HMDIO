import { describe, expect, it } from 'vitest';
import { gehaltstagAusEingabe, gehaltstagHinweis } from './model';

describe('Gehaltstag', () => {
  it('läuft rund: von 1 runter auf 31 (Monatsende), von 31 hoch auf 1', () => {
    expect(gehaltstagAusEingabe(0)).toBe(31);
    expect(gehaltstagAusEingabe(32)).toBe(1);
    expect(gehaltstagAusEingabe(15)).toBe(15);
  });

  it('ignoriert Unsinn', () => {
    expect(gehaltstagAusEingabe(-1)).toBeNull();
    expect(gehaltstagAusEingabe(33)).toBeNull();
    expect(gehaltstagAusEingabe(2.5)).toBeNull();
    expect(gehaltstagAusEingabe(Number.NaN)).toBeNull();
  });

  it('nennt ab dem 29. den echten Tag in diesem Monat', () => {
    expect(gehaltstagHinweis(31, '2026-11-07')).toBe('Tag im Monat; 31 = Monatsende (diesen Monat: 30.11.)');
    expect(gehaltstagHinweis(30, '2027-02-10')).toBe('Tag im Monat; 31 = Monatsende (diesen Monat: 28.02.)');
    expect(gehaltstagHinweis(15, '2026-11-07')).toBe('Tag im Monat; 31 = Monatsende');
  });
});
