import type { FeatureModule } from '../../core';
import { SparenSeite } from './SparenSeite';
import { sparenBasis, type SparenDaten } from './model';

export { sparenAus, zielErreichtIm, type Sparziel } from './model';

export const sparenModul: FeatureModule<SparenDaten> = {
  ...sparenBasis,
  seiten: [{ id: 'sparen', titel: 'Sparen & Rücklagen', reihenfolge: 40, Komponente: SparenSeite }],
};
