import { useState } from 'react';
import {
  RHYTHMEN,
  RHYTHMUS_LABEL,
  addMonths,
  clampedDate,
  clock,
  formatEuro,
  isIsoDate,
  monthlyEquivalent,
  neueId,
  parseIso,
  store,
  withSlice,
  type Rhythmus,
} from '../../core';
import { Dialog, Feld, GeldInput } from '../../ui';
import { alsOffenMarkieren, useKonten } from '../konten';
import { kannRuecklage, terminKey, zahlungenAus, zahlungenBasis, type Posten } from './model';

const KATEGORIEN = ['Wohnen', 'Versicherungen', 'Mobilität', 'Verträge & Abos', 'Gesundheit', 'Geschenke', 'Sparen', 'Sonstiges'];

function naechsterTag(tag: number): string {
  const heute = clock().heute();
  const { y, m } = parseIso(heute);
  const dieserMonat = clampedDate(y, m, tag);
  if (dieserMonat > heute) return dieserMonat;
  const n = addMonths(y, m, 1);
  return clampedDate(n.y, n.m, tag);
}

/** Anlegen und Bearbeiten von Fixkosten, Rechnungen und Umbuchungen. */
export function PostenDialog(props: { posten?: Posten; vorlage?: 'rechnung' | 'umbuchung'; onClose: () => void }) {
  const { konten } = useKonten();
  const p = props.posten;
  const kontoId = (art: string, fallback: string) => konten.find((k) => k.art === art)?.id ?? fallback;
  const giro = kontoId('giro', konten[0]?.id ?? '');

  const [umbuchung, setUmbuchung] = useState(p ? !!p.nachKonto : props.vorlage === 'umbuchung');
  const [name, setName] = useState(p?.name ?? '');
  const [betrag, setBetrag] = useState<number | null>(p?.betrag ?? null);
  const [vonKonto, setVonKonto] = useState(p?.vonKonto ?? giro);
  const [nachKonto, setNachKonto] = useState(p?.nachKonto ?? kontoId('spar', giro));
  const [rhythmus, setRhythmus] = useState<Rhythmus>(p?.rhythmus ?? (props.vorlage === 'rechnung' ? 'einmalig' : 'monatlich'));
  const [start, setStart] = useState(p?.start ?? clock().heute());
  const [ende, setEnde] = useState(p?.ende ?? '');
  const [kategorie, setKategorie] = useState(p?.kategorie ?? (umbuchung ? 'Sparen' : ''));
  const [mitRuecklage, setMitRuecklage] = useState(p ? !!p.ruecklage : true);
  const [rKonto, setRKonto] = useState(p?.ruecklage?.konto ?? kontoId('geldmarkt', giro));
  const [rVon, setRVon] = useState(p?.ruecklage?.vonKonto ?? giro);
  const [rTag, setRTag] = useState(p?.ruecklage?.tag ?? 1);
  const [rStart, setRStart] = useState(p?.ruecklage?.start ?? naechsterTag(1));

  const ruecklageMoeglich = kannRuecklage({ rhythmus, nachKonto: umbuchung ? 'x' : undefined });
  const gueltig =
    name.trim() !== '' &&
    betrag !== null &&
    betrag > 0 &&
    isIsoDate(start) &&
    (ende === '' || (isIsoDate(ende) && ende >= start)) &&
    (!umbuchung || nachKonto !== vonKonto) &&
    (!ruecklageMoeglich || !mitRuecklage || (isIsoDate(rStart) && rKonto !== rVon));

  function speichern() {
    if (!gueltig || betrag === null) return;
    const neu: Posten = {
      id: p?.id ?? neueId(),
      name: name.trim(),
      kategorie: kategorie.trim() || 'Sonstiges',
      betrag,
      vonKonto,
      nachKonto: umbuchung ? nachKonto : undefined,
      rhythmus,
      start,
      ende: ende || undefined,
      ruecklage: ruecklageMoeglich && mitRuecklage ? { konto: rKonto, vonKonto: rVon, tag: rTag, start: rStart } : undefined,
    };
    let data = store().get();
    const daten = zahlungenAus(data);
    data = withSlice(data, zahlungenBasis, {
      posten: p ? daten.posten.map((x) => (x.id === p.id ? neu : x)) : [...daten.posten, neu],
    });
    // Neu eingetragene Rechnung, die schon fällig war: gilt als noch nicht bezahlt.
    if (!p && rhythmus === 'einmalig') data = alsOffenMarkieren(data, vonKonto, terminKey(neu.id, start), start);
    store().set(data);
    props.onClose();
  }

  const kontoAuswahl = (id: string, value: string, set: (v: string) => void) => (
    <select id={id} value={value} onChange={(e) => set(e.target.value)}>
      {konten.map((k) => (
        <option key={k.id} value={k.id}>
          {k.name}
        </option>
      ))}
    </select>
  );

  const titel = p ? 'Bearbeiten' : umbuchung ? 'Neue Umbuchung' : rhythmus === 'einmalig' ? 'Neue Rechnung' : 'Neue Fixkosten';
  const letzterStand = konten.find((k) => k.id === vonKonto)?.abgleich.datum;
  const istAbgleichVorbei = !p && rhythmus === 'einmalig' && letzterStand !== undefined && start <= letzterStand;

  return (
    <Dialog titel={titel} onClose={props.onClose}>
      <form
        className="formular"
        onSubmit={(e) => {
          e.preventDefault();
          speichern();
        }}
      >
        <div className="tabs" role="tablist" aria-label="Art" style={{ alignSelf: 'flex-start' }}>
          <button type="button" role="tab" aria-selected={!umbuchung} onClick={() => setUmbuchung(false)}>
            Abbuchung
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={umbuchung}
            onClick={() => {
              setUmbuchung(true);
              if (!kategorie) setKategorie('Sparen');
            }}
          >
            Umbuchung / Sparrate
          </button>
        </div>

        <Feld label="Bezeichnung">
          {(id) => <input id={id} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={umbuchung ? 'z. B. ETF-Sparplan' : 'z. B. Kfz-Versicherung'} autoFocus />}
        </Feld>

        <div className="formular-raster">
          <Feld label="Betrag">{(id) => <GeldInput id={id} value={betrag} onChange={setBetrag} />}</Feld>
          <Feld label="Kategorie">
            {(id) => (
              <>
                <input id={id} type="text" list={id + '-liste'} value={kategorie} onChange={(e) => setKategorie(e.target.value)} />
                <datalist id={id + '-liste'}>
                  {KATEGORIEN.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </>
            )}
          </Feld>
          <Feld label={umbuchung ? 'Von Konto' : 'Geht ab von'}>{(id) => kontoAuswahl(id, vonKonto, setVonKonto)}</Feld>
          {umbuchung && <Feld label="Auf Konto">{(id) => kontoAuswahl(id, nachKonto, setNachKonto)}</Feld>}
          <Feld label="Wiederholung">
            {(id) => (
              <select id={id} value={rhythmus} onChange={(e) => setRhythmus(e.target.value as Rhythmus)}>
                {RHYTHMEN.map((r) => (
                  <option key={r} value={r}>
                    {RHYTHMUS_LABEL[r]}
                  </option>
                ))}
              </select>
            )}
          </Feld>
          <Feld label={rhythmus === 'einmalig' ? 'Fällig am' : 'Erste Fälligkeit'}>
            {(id) => <input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}
          </Feld>
          {rhythmus !== 'einmalig' && (
            <Feld label="Endet am (optional)">{(id) => <input id={id} type="date" value={ende} onChange={(e) => setEnde(e.target.value)} />}</Feld>
          )}
        </div>

        {istAbgleichVorbei && (
          <p className="infobox">Das Datum liegt vor dem letzten Kontostand. Die Rechnung wird als noch nicht abgegangen gezählt.</p>
        )}

        {ruecklageMoeglich && (
          <div className="infobox formular" style={{ color: 'var(--tinte)' }}>
            <label className="checkbox">
              <input type="checkbox" checked={mitRuecklage} onChange={(e) => setMitRuecklage(e.target.checked)} />
              Monatlich Rücklage bilden{betrag ? ` (${formatEuro(monthlyEquivalent(betrag, rhythmus))} pro Monat)` : ''}
            </label>
            {mitRuecklage && (
              <div className="formular-raster">
                <Feld label="Rate geht ab von">{(id) => kontoAuswahl(id, rVon, setRVon)}</Feld>
                <Feld label="Rücklage auf">{(id) => kontoAuswahl(id, rKonto, setRKonto)}</Feld>
                <Feld label="Tag der Rate" hinweis="Tag im Monat">
                  {(id) => (
                    <input
                      id={id}
                      type="number"
                      min={1}
                      max={31}
                      value={rTag}
                      onChange={(e) => {
                        const t = Number(e.target.value);
                        if (Number.isInteger(t) && t >= 1 && t <= 31) {
                          setRTag(t);
                          if (!p?.ruecklage) setRStart(naechsterTag(t));
                        }
                      }}
                    />
                  )}
                </Feld>
                <Feld label="Erste Rate">{(id) => <input id={id} type="date" value={rStart} onChange={(e) => setRStart(e.target.value)} />}</Feld>
              </div>
            )}
            {mitRuecklage && rKonto !== vonKonto && (
              <span className="hinweis">
                Am Fälligkeitstag wird der Betrag als Ausgleich vom Rücklagekonto zurück auf das Zahlkonto eingeplant.
              </span>
            )}
          </div>
        )}

        <div className="dialog-fuss">
          <button type="button" className="btn" onClick={props.onClose}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn-primary" disabled={!gueltig}>
            Speichern
          </button>
        </div>
      </form>
    </Dialog>
  );
}
