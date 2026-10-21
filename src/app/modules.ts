import type { FeatureModule } from '../core';
import { budgetsModul } from '../modules/budgets';
import { kontenModul } from '../modules/konten';
import { sparenModul } from '../modules/sparen';
import { uebersichtModul } from '../modules/uebersicht';
import { zahlungenModul } from '../modules/zahlungen';

/**
 * Alle aktiven Module. Ein neues Feature = neuer Ordner unter src/modules
 * plus ein Eintrag hier. Navigation, Speicherung und Berechnungen ergeben sich daraus.
 */
export const MODULE: FeatureModule[] = [uebersichtModul, zahlungenModul, budgetsModul, sparenModul, kontenModul] as FeatureModule[];
