import type { FeatureModule } from '../../core';
import { ZahlungenSeite } from './ZahlungenSeite';
import { zahlungenBasis, type ZahlungenDaten } from './model';

export { PostenDialog } from './PostenDialog';
export {
  ART_LABEL,
  monatsBelastung,
  monatlicheZufluesse,
  ruecklagenSoll,
  useZahlungen,
  zahlungenAus,
  type MonatsBelastung,
  type Posten,
  type RuecklagenStand,
} from './model';

export const zahlungenModul: FeatureModule<ZahlungenDaten> = {
  ...zahlungenBasis,
  seiten: [{ id: 'zahlungen', titel: 'Abbuchungen & Fixkosten', reihenfolge: 20, Komponente: ZahlungenSeite }],
};
