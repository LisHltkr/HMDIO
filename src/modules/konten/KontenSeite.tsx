import { useState } from 'react';
import { formatLong, formatShort, neueId, useAppData } from '../../core';
import { Betrag, Feld, GeldInput, Karte, SeitenKopf } from '../../ui';
import { AbgleichDialog } from './AbgleichDialog';
import {
  KONTO_ARTEN,
  KONTO_ART_LABEL,
  aktualisiereKonten,
  ausblickFuer,
  istEingetragen,
  kontenAus,
  kontextAus,
  neuesKonto,
  type KontoArt,
} from './model';

export function KontenSeite() {
  const data = useAppData();
  const daten = kontenAus(data);
  const kontext = kontextAus(data);
  const [abgleichFuer, setAbgleichFuer] = useState<string | null>(null);

  return (
    <>
      <SeitenKopf
        titel="Konten"
        untertitel={`Stände werden von Hand eingetragen · nächster Gehaltseingang am ${formatLong(kontext.naechsterGehaltstag)}`}
      />

      <div className="raster">
        {daten.konten.map((konto) => {
          const a = ausblickFuer(data, konto, kontext);
          const prognose = a.effektiverStand - a.abgaenge + a.zugaenge;
          return (
            <Karte
              key={konto.id}
              titel={konto.name}
              aktion={konto.name !== KONTO_ART_LABEL[konto.art] && <span className="gedaempft klein">{KONTO_ART_LABEL[konto.art]}</span>}
            >
              <div>
                <Betrag cents={a.effektiverStand} className="kennzahl-wert" />
                <p className="gedaempft klein">
                  {istEingetragen(konto) ? `eingetragen am ${formatLong(konto.abgleich.datum)}` : 'noch kein Stand eingetragen'}
                  {a.effektiverStand !== konto.abgleich.stand && ' · abzüglich seither erfasster Ausgaben'}
                </p>
              </div>
              <dl className="rechnung">
                <div>
                  <dt>Ausstehende Abgänge bis {formatShort(kontext.naechsterGehaltstag)}</dt>
                  <dd><Betrag cents={-a.abgaenge} vorzeichen /></dd>
                </div>
                <div>
                  <dt>Ausstehende Zugänge</dt>
                  <dd><Betrag cents={a.zugaenge} vorzeichen /></dd>
                </div>
                <div className="summe">
                  <dt>Voraussichtlich am {formatShort(kontext.naechsterGehaltstag)}</dt>
                  <dd><Betrag cents={prognose} className={prognose < 0 ? 'negativ' : ''} /></dd>
                </div>
              </dl>
              <div className="aktionen">
                <button type="button" className="btn btn-primary" onClick={() => setAbgleichFuer(konto.id)}>
                  Kontostand aktualisieren
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    const name = window.prompt('Neuer Name', konto.name)?.trim();
                    if (name) aktualisiereKonten((d) => ({ ...d, konten: d.konten.map((k) => (k.id === konto.id ? { ...k, name } : k)) }));
                  }}
                >
                  Umbenennen
                </button>
              </div>
            </Karte>
          );
        })}
      </div>

      <div className="zeile">
        <GehaltKarte />
        <NeuesKontoKarte />
      </div>

      {abgleichFuer && <AbgleichDialog kontoId={abgleichFuer} onClose={() => setAbgleichFuer(null)} />}
    </>
  );
}

function GehaltKarte() {
  const data = useAppData();
  const { gehalt, konten } = kontenAus(data);
  return (
    <Karte titel="Gehalt">
      <p className="gedaempft klein">
        „Ausstehend“ zählt alles bis zum Tag vor dem nächsten Gehaltseingang. Termine am Gehaltstag trägt schon das neue Gehalt.
      </p>
      <div className="formular-raster">
        <Feld label="Nettogehalt pro Monat">
          {(id) => (
            <GeldInput id={id} value={gehalt.betrag} onChange={(c) => c !== null && aktualisiereKonten((d) => ({ ...d, gehalt: { ...d.gehalt, betrag: c } }))} />
          )}
        </Feld>
        <Feld label="Gehaltseingang am" hinweis="Tag im Monat; 31 = Monatsende">
          {(id) => (
            <input
              id={id}
              type="number"
              min={1}
              max={31}
              value={gehalt.tag}
              onChange={(e) => {
                const tag = Number(e.target.value);
                if (Number.isInteger(tag) && tag >= 1 && tag <= 31) aktualisiereKonten((d) => ({ ...d, gehalt: { ...d.gehalt, tag } }));
              }}
            />
          )}
        </Feld>
        <Feld label="Geht ein auf">
          {(id) => (
            <select id={id} value={gehalt.konto} onChange={(e) => aktualisiereKonten((d) => ({ ...d, gehalt: { ...d.gehalt, konto: e.target.value } }))}>
              {konten.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          )}
        </Feld>
      </div>
    </Karte>
  );
}

function NeuesKontoKarte() {
  const [name, setName] = useState('');
  const [art, setArt] = useState<KontoArt>('spar');
  return (
    <Karte titel="Weiteres Konto">
      <form
        className="formular"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          aktualisiereKonten((d) => ({ ...d, konten: [...d.konten, neuesKonto(neueId(), name.trim(), art)] }));
          setName('');
        }}
      >
        <div className="formular-raster">
          <Feld label="Name">{(id) => <input id={id} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Tagesgeld" />}</Feld>
          <Feld label="Art">
            {(id) => (
              <select id={id} value={art} onChange={(e) => setArt(e.target.value as KontoArt)}>
                {KONTO_ARTEN.map((a) => (
                  <option key={a} value={a}>
                    {KONTO_ART_LABEL[a]}
                  </option>
                ))}
              </select>
            )}
          </Feld>
        </div>
        <button type="submit" className="btn" style={{ alignSelf: 'flex-start' }} disabled={!name.trim()}>
          Konto hinzufügen
        </button>
      </form>
    </Karte>
  );
}
