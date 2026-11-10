import { describe, expect, it } from 'vitest';
import { formatLong, parseDatumDe } from './date';

describe('Datum in deutscher Schreibweise', () => {
  it('liest TT.MM.JJJJ und kurze Varianten', () => {
    expect(parseDatumDe('15.11.2026')).toBe('2026-11-15');
    expect(parseDatumDe('5.1.26')).toBe('2026-01-05');
    expect(parseDatumDe(' 01-12-2026 ')).toBe('2026-12-01');
    expect(parseDatumDe('3/4/2027')).toBe('2027-04-03');
    expect(parseDatumDe('15,11,2026')).toBe('2026-11-15'); // Komma-Taste am deutschen Ziffernblock
  });

  it('liest reine Ziffern (Ziffernblock am Handy)', () => {
    expect(parseDatumDe('15112026')).toBe('2026-11-15');
    expect(parseDatumDe('151126')).toBe('2026-11-15');
  });

  it('lehnt Unmögliches und Unvollständiges ab', () => {
    expect(parseDatumDe('29.02.2027')).toBeNull();
    expect(parseDatumDe('29.02.2028')).toBe('2028-02-29');
    expect(parseDatumDe('32.01.2026')).toBeNull();
    expect(parseDatumDe('15.13.2026')).toBeNull();
    expect(parseDatumDe('15.11.')).toBeNull();
    expect(parseDatumDe('2026-11-15')).toBeNull();
    expect(parseDatumDe('abc')).toBeNull();
    expect(parseDatumDe('')).toBeNull();
  });

  it('zeigt Daten als TT.MM.JJJJ an – Hin und zurück verlustfrei', () => {
    expect(formatLong('2026-01-05')).toBe('05.01.2026');
    expect(parseDatumDe(formatLong('2026-01-05'))).toBe('2026-01-05');
  });
});
