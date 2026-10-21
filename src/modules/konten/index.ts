import type { FeatureModule } from '../../core';
import { KontenSeite } from './KontenSeite';
import { kontenBasis, type KontenDaten } from './model';

export { AbgleichDialog } from './AbgleichDialog';
export {
  KONTO_ART_LABEL,
  alsOffenMarkieren,
  ausblickFuer,
  istEingetragen,
  kontenAus,
  kontextAus,
  useKonten,
  type Konto,
  type KontoArt,
  type KontenDaten,
} from './model';

export const kontenModul: FeatureModule<KontenDaten> = {
  ...kontenBasis,
  seiten: [{ id: 'konten', titel: 'Konten', reihenfolge: 50, Komponente: KontenSeite }],
};
