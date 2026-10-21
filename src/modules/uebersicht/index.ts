import type { FeatureModule } from '../../core';
import { UebersichtSeite } from './UebersichtSeite';

/** Hat keine eigenen Daten; setzt nur zusammen, was die anderen Module liefern. */
export const uebersichtModul: FeatureModule = {
  id: 'uebersicht',
  seiten: [{ id: 'uebersicht', titel: 'Übersicht', reihenfolge: 10, Komponente: UebersichtSeite }],
};
