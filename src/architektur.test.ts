import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Prüft die Importregeln aus docs/PLAN.md:
 * - core importiert nur core
 * - ui importiert nur core und ui
 * - ein Modul importiert core, ui, sich selbst und von anderen Modulen nur deren index
 */
const SRC = resolve(__dirname);

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const pfad = join(dir, name);
    if (statSync(pfad).isDirectory()) return dateien(pfad);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [pfad] : [];
  });
}

function bereich(pfad: string): string[] {
  return relative(SRC, pfad).split(sep);
}

function verstoesse(): string[] {
  const fehler: string[] = [];
  for (const datei of dateien(SRC)) {
    const [schicht, modul] = bereich(datei);
    const text = readFileSync(datei, 'utf8');
    for (const [, spec] of text.matchAll(/from '(\.[^']*)'/g)) {
      const ziel = bereich(resolve(dirname(datei), spec!));
      const [zSchicht, zModul, zDatei] = ziel;
      const wo = `${relative(SRC, datei)} → ${spec}`;
      if (schicht === 'core' && zSchicht !== 'core') fehler.push(wo);
      if (schicht === 'ui' && zSchicht !== 'core' && zSchicht !== 'ui') fehler.push(wo);
      if (schicht === 'modules') {
        const erlaubt =
          zSchicht === 'core' ||
          zSchicht === 'ui' ||
          (zSchicht === 'modules' && (zModul === modul || zDatei === undefined || zDatei === 'index'));
        if (!erlaubt) fehler.push(wo);
      }
      if ((schicht === 'core' || schicht === 'ui' || schicht === 'modules') && (zSchicht === 'app' || zSchicht === 'storage')) {
        fehler.push(wo);
      }
    }
  }
  return fehler;
}

describe('Architektur', () => {
  it('hält die Importregeln ein', () => {
    expect(verstoesse()).toEqual([]);
  });
});
