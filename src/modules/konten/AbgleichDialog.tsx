import { useMemo, useState } from 'react';
import {
  abgleichKandidaten,
  abgleichZiele,
  abgleichen,
  cashflowQuellen,
  clock,
  formatEuro,
  formatLong,
  formatShort,
  store,
  useAppData,
  withSlice,
  wirkung,
  type Termin,
} from '../../core';
import { Betrag, Dialog, Feld, GeldInput } from '../../ui';
import { ausblickFuer, kontenAus, kontenBasis, kontextAus, istEingetragen } from './model';

const NICHT_ZUORDNEN = '';

/**
 * Kontostand von Hand eintragen. Fällige Termine werden abgehakt, wenn sie abgegangen sind;
 * die Differenz zum erwarteten Stand kann einem Lebensbereich zugeordnet werden.
 */
export function AbgleichDialog(props: { kontoId: string; onClose: () => void }) {
  const data = useAppData();
  const kontext = kontextAus(data);
  const konto = kontenAus(data).konten.find((k) => k.id === props.kontoId);
  const heute = kontext.heute;

  const { faellig, kommend, effektiverStand } = useMemo(() => {
    if (!konto) return { faellig: [], kommend: [], effektiverStand: 0 };
    const ausblick = ausblickFuer(data, konto, kontext);
    return {
      faellig: abgleichKandidaten(cashflowQuellen(), data, konto.id, konto.abgleich, heute),
      kommend: ausblick.ausstehend.filter((t) => t.datum > heute),
      effektiverStand: ausblick.effektiverStand,
    };
    // Nur beim Öffnen berechnen, damit sich die Liste beim Abhaken nicht verschiebt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.kontoId]);

  const [neuerStand, setNeuerStand] = useState<number | null>(null);
  const [abgegangen, setAbgegangen] = useState<Set<string>>(() => new Set(faellig.map((t) => t.key)));
  const [zeigeKommend, setZeigeKommend] = useState(false);
  const ziele = abgleichZiele();
  const optionen = ziele.flatMap((z, i) => z.optionen(data).map((o) => ({ ...o, wert: `${i}|${o.id}` })));
  const [zuordnung, setZuordnung] = useState(NICHT_ZUORDNEN);

  if (!konto) return null;

  const termine = [...faellig, ...kommend];
  const ergebnis =
    neuerStand === null
      ? null
      : abgleichen(konto.abgleich, termine, abgegangen, konto.id, effektiverStand, neuerStand, heute, clock().jetzt());
  const ersterEintrag = !istEingetragen(konto);

  function umschalten(key: string) {
    setAbgegangen((alt) => {
      const neu = new Set(alt);
      if (neu.has(key)) neu.delete(key);
      else neu.add(key);
      return neu;
    });
  }

  function speichern() {
    if (!ergebnis || !konto) return;
    const zeitpunkt = ergebnis.abgleich.zeitpunkt;
    let next = store().get();
    const daten = kontenAus(next);
    next = withSlice(next, kontenBasis, {
      ...daten,
      konten: daten.konten.map((k) => (k.id === konto.id ? { ...k, abgleich: ergebnis.abgleich } : k)),
    });
    if (zuordnung !== NICHT_ZUORDNEN && ergebnis.differenz < 0 && !ersterEintrag) {
      const [index, optionId] = zuordnung.split('|');
      const ziel = ziele[Number(index)];
      if (ziel && optionId) {
        next = ziel.verbuchen(next, { optionId, betrag: -ergebnis.differenz, konto: konto.id, datum: heute, zeitpunkt });
      }
    }
    store().set(next);
    props.onClose();
  }

  const zeile = (t: Termin, standard: string) => {
    const an = abgegangen.has(t.key);
    return (
      <label key={t.key} className={an ? '' : 'offen'}>
        <input type="checkbox" checked={an} onChange={() => umschalten(t.key)} />
        <span className="datum">{formatShort(t.datum)}</span>
        <span className="name">{t.bezeichnung}</span>
        <span className="status">{an ? 'abgegangen' : standard}</span>
        <Betrag cents={wirkung(t, konto.id)} vorzeichen />
      </label>
    );
  };

  return (
    <Dialog titel={`${konto.name}: Kontostand aktualisieren`} onClose={props.onClose} breit>
      <p className="gedaempft">
        {ersterEintrag
          ? 'Trage den aktuellen Stand aus deiner Banking-App ein.'
          : `Letzter Stand: ${formatEuro(konto.abgleich.stand)} am ${formatLong(konto.abgleich.datum)} · heute ist der ${formatLong(heute)}`}
      </p>

      <Feld label="Aktueller Kontostand laut Banking-App">
        {(id) => <GeldInput id={id} value={neuerStand} onChange={setNeuerStand} erlaubeNegativ autoFocus />}
      </Feld>

      {!ersterEintrag && faellig.length > 0 && (
        <fieldset className="abhaken" style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="feld" style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
            Seit dem letzten Stand fällig – schon abgegangen?
          </legend>
          {faellig.map((t) => zeile(t, 'bleibt ausstehend'))}
        </fieldset>
      )}

      {kommend.length > 0 && (
        <div className="abhaken">
          <button type="button" className="btn btn-ghost btn-klein" style={{ alignSelf: 'flex-start' }} aria-expanded={zeigeKommend} onClick={() => setZeigeKommend(!zeigeKommend)}>
            {zeigeKommend ? '▾' : '▸'} Ist etwas schon vorzeitig abgegangen? ({kommend.length} kommende Posten)
          </button>
          {zeigeKommend && kommend.map((t) => zeile(t, 'kommt noch'))}
        </div>
      )}

      {ergebnis && !ersterEintrag && (
        <dl className="rechnung infobox" style={{ color: 'var(--tinte)' }}>
          <div>
            <dt>Erwarteter Stand</dt>
            <dd><Betrag cents={ergebnis.erwartet} /></dd>
          </div>
          <div>
            <dt>Eingetragener Stand</dt>
            <dd><Betrag cents={neuerStand ?? 0} /></dd>
          </div>
          <div className="summe">
            <dt>{ergebnis.differenz < 0 ? 'Differenz = nicht erfasste Ausgaben' : 'Differenz'}</dt>
            <dd><Betrag cents={ergebnis.differenz} vorzeichen className={ergebnis.differenz < 0 ? 'negativ' : ''} /></dd>
          </div>
          {ergebnis.differenz < 0 && optionen.length > 0 && (
            <Feld label="Differenz verbuchen auf" hinweis="Zählt dann als Ausgabe im gewählten Budget.">
              {(id) => (
                <select id={id} value={zuordnung} onChange={(e) => setZuordnung(e.target.value)}>
                  <option value={NICHT_ZUORDNEN}>nicht zuordnen</option>
                  {optionen.map((o) => (
                    <option key={o.wert} value={o.wert}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </Feld>
          )}
        </dl>
      )}

      <div className="dialog-fuss">
        <button type="button" className="btn" onClick={props.onClose}>
          Abbrechen
        </button>
        <button type="button" className="btn btn-primary" disabled={neuerStand === null} onClick={speichern}>
          Übernehmen
        </button>
      </div>
    </Dialog>
  );
}
