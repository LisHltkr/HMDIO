import { useState } from 'react';
import { formatLong, formatMonth, formatShort, neueId, sum, useAppData } from '../../core';
import { Betrag, Dialog, Feld, Fortschritt, GeldInput, Karte, Leer, SeitenKopf } from '../../ui';
import { KONTO_ART_LABEL, ausblickFuer, kontenAus, kontextAus } from '../konten';
import { monatlicheZufluesse, monatsBelastung, ruecklagenSoll, zahlungenAus } from '../zahlungen';
import { aktualisiereSparen, sparenAus, zielErreichtIm, type Sparziel } from './model';

export function SparenSeite() {
  const data = useAppData();
  const { konten, gehalt } = kontenAus(data);
  const zahlungen = zahlungenAus(data);
  const { ziele } = sparenAus(data);
  const kontext = kontextAus(data);
  const stand = (kontoId: string) => {
    const k = konten.find((x) => x.id === kontoId);
    return k ? ausblickFuer(data, k, kontext).effektiverStand : 0;
  };
  const fixkostenProMonat = monatsBelastung(zahlungen, gehalt.konto).fixkosten;
  const ruecklagenKonten = konten.filter((k) => ruecklagenSoll(zahlungen, k.id, kontext.heute).length > 0);
  const [bearbeiten, setBearbeiten] = useState<Sparziel | null>(null);

  return (
    <>
      <SeitenKopf titel="Sparen & Rücklagen" untertitel="Puffer, Sparziele und ob die Rücklagen für seltene Kosten reichen" />

      <div className="raster">
        {ziele.map((ziel) => {
          const ist = stand(ziel.konto);
          const rate = monatlicheZufluesse(zahlungen, ziel.konto);
          const erreicht = ziel.zielBetrag > 0 ? zielErreichtIm(ist, ziel.zielBetrag, rate, kontext.heute) : null;
          const konto = konten.find((k) => k.id === ziel.konto);
          return (
            <Karte
              key={ziel.id}
              titel={ziel.name}
              aktion={
                <button type="button" className="btn btn-ghost btn-klein" onClick={() => setBearbeiten(ziel)}>
                  Bearbeiten
                </button>
              }
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <Betrag cents={ist} className="kennzahl-wert" />
                {ziel.zielBetrag > 0 && (
                  <span className="gedaempft">
                    von <Betrag cents={ziel.zielBetrag} /> Ziel
                  </span>
                )}
              </div>
              {ziel.zielBetrag > 0 && <Fortschritt label={`${ziel.name}: Fortschritt`} anteil={ist / ziel.zielBetrag} />}
              <div className="mini-kennzahlen">
                <div>
                  <span className="gedaempft klein">Monatlich dazu</span>
                  <strong><Betrag cents={rate} /></strong>
                </div>
                <div>
                  <span className="gedaempft klein">Deckt Fixkosten für</span>
                  <strong>{fixkostenProMonat > 0 ? `${(ist / fixkostenProMonat).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Monate` : '–'}</strong>
                </div>
              </div>
              <p className="gedaempft klein">
                Auf {konto?.name ?? 'unbekanntem Konto'}
                {erreicht === 'erreicht' && ' · Ziel erreicht'}
                {typeof erreicht === 'string' && erreicht !== 'erreicht' && ` · Ziel voraussichtlich im ${formatMonth(erreicht)}`}
                {erreicht === null && ziel.zielBetrag > 0 && ' · ohne monatliche Sparrate wird das Ziel nicht erreicht'}
              </p>
            </Karte>
          );
        })}
        <Karte titel="Neues Sparziel">
          <button type="button" className="btn" style={{ alignSelf: 'flex-start' }} onClick={() => setBearbeiten({ id: '', name: '', konto: konten.find((k) => k.art === 'spar')?.id ?? konten[0]?.id ?? '', zielBetrag: 0 })}>
            + Sparziel anlegen
          </button>
        </Karte>
      </div>

      {ruecklagenKonten.length === 0 ? (
        <Karte titel="Rücklagen">
          <Leer>Noch keine Rücklagen. Leg jährliche oder vierteljährliche Kosten unter „Abbuchungen & Fixkosten“ mit „Monatlich Rücklage bilden“ an.</Leer>
        </Karte>
      ) : (
        ruecklagenKonten.map((k) => {
          const liste = ruecklagenSoll(zahlungen, k.id, kontext.heute);
          const soll = sum(liste.map((r) => r.soll));
          const ist = stand(k.id);
          return (
            <Karte
              key={k.id}
              titel={`Rücklagen auf ${k.name}`}
              aktion={
                <span className="gedaempft">
                  Ist <Betrag cents={ist} /> · Soll <Betrag cents={soll} />
                </span>
              }
            >
              {ist < soll && (
                <p className="hinweisbox">
                  Auf dem {KONTO_ART_LABEL[k.art]} fehlen <strong><Betrag cents={soll - ist} /></strong>, damit alle kommenden Zahlungen gedeckt sind.
                </p>
              )}
              <div className="tabelle-box">
                <table style={{ minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th scope="col">Wofür</th>
                      <th scope="col">Nächste Fälligkeit</th>
                      <th scope="col" className="rechts">Betrag</th>
                      <th scope="col" className="rechts">Soll heute</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liste.map((r) => (
                      <tr key={r.posten.id}>
                        <td>{r.posten.name}</td>
                        <td className="gedaempft">{r.naechsteFaelligkeit ? formatLong(r.naechsteFaelligkeit) : '–'}</td>
                        <td className="rechts"><Betrag cents={r.posten.betrag} /></td>
                        <td className="rechts"><Betrag cents={r.soll} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hinweis">Soll = Betrag minus der Raten, die bis zur Fälligkeit noch kommen. Stand vom {formatShort(kontext.heute)}.</p>
            </Karte>
          );
        })
      )}

      {bearbeiten && <ZielDialog ziel={bearbeiten} onClose={() => setBearbeiten(null)} />}
    </>
  );
}

function ZielDialog(props: { ziel: Sparziel; onClose: () => void }) {
  const data = useAppData();
  const { konten } = kontenAus(data);
  const [name, setName] = useState(props.ziel.name);
  const [konto, setKonto] = useState(props.ziel.konto);
  const [ziel, setZiel] = useState<number | null>(props.ziel.zielBetrag);
  const neu = props.ziel.id === '';
  const gueltig = name.trim() !== '' && ziel !== null;

  return (
    <Dialog titel={neu ? 'Neues Sparziel' : 'Sparziel bearbeiten'} onClose={props.onClose}>
      <form
        className="formular"
        onSubmit={(e) => {
          e.preventDefault();
          if (!gueltig || ziel === null) return;
          const eintrag = { id: neu ? neueId() : props.ziel.id, name: name.trim(), konto, zielBetrag: ziel };
          aktualisiereSparen((d) => ({ ziele: neu ? [...d.ziele, eintrag] : d.ziele.map((z) => (z.id === eintrag.id ? eintrag : z)) }));
          props.onClose();
        }}
      >
        <Feld label="Name">{(id) => <input id={id} type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />}</Feld>
        <div className="formular-raster">
          <Feld label="Konto">
            {(id) => (
              <select id={id} value={konto} onChange={(e) => setKonto(e.target.value)}>
                {konten.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
          </Feld>
          <Feld label="Zielbetrag">{(id) => <GeldInput id={id} value={ziel} onChange={setZiel} />}</Feld>
        </div>
        <div className="dialog-fuss">
          {!neu && (
            <button
              type="button"
              className="btn btn-ghost btn-danger"
              style={{ marginRight: 'auto' }}
              onClick={() => {
                if (window.confirm(`Sparziel „${props.ziel.name}“ löschen?`)) {
                  aktualisiereSparen((d) => ({ ziele: d.ziele.filter((z) => z.id !== props.ziel.id) }));
                  props.onClose();
                }
              }}
            >
              Löschen
            </button>
          )}
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
