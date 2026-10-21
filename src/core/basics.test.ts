import { describe, expect, it } from 'vitest';
import { formatEuro, parseEuro } from './money';
import { addDays, clampedDate, isIsoDate, monthsBetween } from './date';
import { monthlyEquivalent, occurrencesBetween } from './recurrence';
import { lastPayday, nextPayday } from './payday';

describe('money', () => {
  it('liest deutsche Eingaben', () => {
    expect(parseEuro('1.234,56')).toBe(123456);
    expect(parseEuro('12,5')).toBe(1250);
    expect(parseEuro('80')).toBe(8000);
    expect(parseEuro('1.234')).toBe(123400);
    expect(parseEuro('12.50')).toBe(1250);
    expect(parseEuro('−85,00 €')).toBe(-8500);
    expect(parseEuro('abc')).toBeNull();
    expect(parseEuro('')).toBeNull();
    expect(parseEuro('1,234')).toBeNull();
  });

  it('formatiert in Euro', () => {
    expect(formatEuro(123456).replace(/\s/g, ' ')).toBe('1.234,56 €');
  });
});

describe('date', () => {
  it('setzt zu große Tage aufs Monatsende', () => {
    expect(clampedDate(2026, 2, 31)).toBe('2026-02-28');
    expect(clampedDate(2028, 2, 31)).toBe('2028-02-29');
  });
  it('rechnet Tage und Monate', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(monthsBetween('2026-10-28', '2027-01-01')).toBe(3);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
  });
});

describe('recurrence', () => {
  it('erzeugt monatliche Termine mit Monatsende-Clamp', () => {
    expect(occurrencesBetween({ rhythmus: 'monatlich', start: '2026-01-31' }, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });
  it('findet jährliche Termine weit nach dem Start', () => {
    expect(occurrencesBetween({ rhythmus: 'jaehrlich', start: '2020-10-28' }, '2026-10-01', '2027-12-31')).toEqual([
      '2026-10-28',
      '2027-10-28',
    ]);
  });
  it('beachtet Ende und einmalige Termine', () => {
    expect(
      occurrencesBetween({ rhythmus: 'monatlich', start: '2026-01-15', ende: '2026-03-15' }, '2026-01-01', '2026-12-31'),
    ).toHaveLength(3);
    expect(occurrencesBetween({ rhythmus: 'einmalig', start: '2026-10-26' }, '2026-10-21', '2026-10-31')).toEqual([
      '2026-10-26',
    ]);
    expect(occurrencesBetween({ rhythmus: 'einmalig', start: '2026-11-26' }, '2026-10-21', '2026-10-31')).toEqual([]);
  });
  it('liefert keine Termine vor dem Start', () => {
    expect(occurrencesBetween({ rhythmus: 'vierteljaehrlich', start: '2026-11-15' }, '2026-01-01', '2027-03-01')).toEqual([
      '2026-11-15',
      '2027-02-15',
    ]);
  });
  it('rechnet monatliche Gegenwerte aufgerundet', () => {
    expect(monthlyEquivalent(64000, 'jaehrlich')).toBe(5334);
    expect(monthlyEquivalent(5508, 'vierteljaehrlich')).toBe(1836);
    expect(monthlyEquivalent(7000, 'einmalig')).toBe(0);
  });
});

describe('payday', () => {
  it('findet den nächsten Gehaltstag strikt nach heute', () => {
    expect(nextPayday(31, '2026-10-21')).toBe('2026-10-31');
    expect(nextPayday(31, '2026-10-31')).toBe('2026-11-30');
    expect(nextPayday(1, '2026-12-15')).toBe('2027-01-01');
  });
  it('findet den letzten Gehaltstag bis heute', () => {
    expect(lastPayday(31, '2026-10-21')).toBe('2026-09-30');
    expect(lastPayday(31, '2026-10-31')).toBe('2026-10-31');
    expect(lastPayday(15, '2026-01-10')).toBe('2025-12-15');
  });
});
