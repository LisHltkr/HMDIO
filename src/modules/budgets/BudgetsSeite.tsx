import { useState } from 'react';
import { clock, formatLong, formatShort, neueId, sum, useAppData } from '../../core';
import { Betrag, Feld, Fortschritt, GeldInput, Karte, Kennzahl, Leer, SeitenKopf } from '../../ui';
import { kontextAus, useKonten } from '../konten';
import { monatsBelastung, useZahlungen } from '../zahlungen';
import { aktualisiereBudgets, budgetStaende, neueAusgabe, useBudgets, type Kategorie } from './model';

const SCHRITT = 1000;

export function BudgetsSeite() {
  const data = useAppData();
  const budgets = useBudgets();
  const { gehalt, konten } = useKonten();
  const zahlungen = useZahlungen();
  const kontext = kontextAus(data);
  const staende = budgetStaende(budgets, kontext);

  const belastung = monatsBelastung(zahlungen, gehalt.konto);
  const verteilbar = gehalt.betrag - belastung.fixkosten - belastung.ruecklagen - belastung.sparen;
  const verteilt = sum(budgets.kategorien.map((k) => k.betrag));
  const unverteilt = verteilbar - verteilt;

  const setzeBetrag = (id: string, betrag: number) =>
    aktualisiereBudgets((d) => ({ ...d, kategorien: d.kategorien.map((k) => (k.id === id ? { ...k, betrag: Math.max(0, betrag) } : k)) }));

  return (
    <>
      <SeitenKopf
        titel="Budgets"
        untertitel={`Budgetmonat ${formatShort(kontext.letzterGehaltstag)} bis ${formatShort(kontext.naechsterGehaltstag)} · jeder Euro bekommt eine Aufgabe`}
      />

      <section aria-label="Verteilbares Einkommen" className="kennzahlen">
        <Kennzahl label="Nettogehalt"><Betrag cents={gehalt.betrag} /></Kennzahl>
        <Kennzahl label="− Fixkosten"><Betrag cents={belastung.fixkosten} /></Kennzahl>
        <Kennzahl label="− Rücklagen"><Betrag cents={belastung.ruecklagen} /></Kennzahl>
        <Kennzahl label="− Sparen & Depot"><Betrag cents={belastung.sparen} /></Kennzahl>
        <Kennzahl label={unverteilt < 0 ? 'Zu viel verplant' : 'Noch nicht verteilt'} ton={unverteilt < 0 ? 'warnung' : 'gut'}>
          <Betrag cents={unverteilt} />
        </Kennzahl>
      </section>
      {gehalt.betrag === 0 && <p className="hinweisbox">Trag unter „Konten“ dein Nettogehalt ein, dann siehst du, wie viel du verteilen kannst.</p>}

      <div className="zeile">
        <Karte
          titel="Lebensbereiche"
          aktion={<span className="gedaempft">Verteilt <Betrag cents={verteilt} /> von <Betrag cents={Math.max(0, verteilbar)} /></span>}
        >
          <div>
            {staende.map(({ kategorie, ausgegeben, rest }) => (
              <div key={kategorie.id} className="budget-zeile">
                <div style={{ flex: '1 1 220px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong style={{ fontWeight: 600 }}>{kategorie.name}</strong>
                    <span className="gedaempft klein">
                      <Betrag cents={ausgegeben} /> ausgegeben · <Betrag cents={rest} /> übrig
                    </span>
                  </div>
                  <Fortschritt
                    label={`${kategorie.name}: verbraucht`}
                    anteil={kategorie.betrag ? ausgegeben / kategorie.betrag : ausgegeben > 0 ? 1 : 0}
                    ton={ausgegeben > kategorie.betrag ? 'warnung' : 'neutral'}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button type="button" className="btn" aria-label={`${kategorie.name} um 10 € verringern`} onClick={() => setzeBetrag(kategorie.id, kategorie.betrag - SCHRITT)}>
                    −
                  </button>
                  <div style={{ width: 120 }}>
                    <GeldInput value={kategorie.betrag} onChange={(c) => c !== null && setzeBetrag(kategorie.id, c)} />
                  </div>
                  <button type="button" className="btn" aria-label={`${kategorie.name} um 10 € erhöhen`} onClick={() => setzeBetrag(kategorie.id, kategorie.betrag + SCHRITT)}>
                    +
                  </button>
                  <KategorieMenue kategorie={kategorie} kontoNamen={konten.map((k) => ({ id: k.id, name: k.name }))} />
                </div>
              </div>
            ))}
          </div>
          <NeueKategorie standardKonto={gehalt.konto} />
        </Karte>

        <AusgabenKarte />
      </div>
    </>
  );
}

function KategorieMenue(props: { kategorie: Kategorie; kontoNamen: { id: string; name: string }[] }) {
  const k = props.kategorie;
  return (
    <select
      aria-label={`${k.name}: weitere Aktionen`}
      value=""
      style={{ width: 44, paddingRight: 0 }}
      onChange={(e) => {
        const v = e.target.value;
        if (v === 'umbenennen') {
          const name = window.prompt('Neuer Name', k.name)?.trim();
          if (name) aktualisiereBudgets((d) => ({ ...d, kategorien: d.kategorien.map((x) => (x.id === k.id ? { ...x, name } : x)) }));
        } else if (v === 'loeschen') {
          if (window.confirm(`Lebensbereich „${k.name}“ löschen? Erfasste Ausgaben bleiben erhalten.`)) {
            aktualisiereBudgets((d) => ({ ...d, kategorien: d.kategorien.filter((x) => x.id !== k.id) }));
          }
        } else if (v.startsWith('konto:')) {
          const konto = v.slice(6);
          aktualisiereBudgets((d) => ({ ...d, kategorien: d.kategorien.map((x) => (x.id === k.id ? { ...x, konto } : x)) }));
        }
      }}
    >
      <option value="">⋯</option>
      <option value="umbenennen">Umbenennen</option>
      <optgroup label="Bezahlt von">
        {props.kontoNamen.map((kn) => (
          <option key={kn.id} value={'konto:' + kn.id}>
            {kn.id === k.konto ? '✓ ' : ''}
            {kn.name}
          </option>
        ))}
      </optgroup>
      <option value="loeschen">Löschen</option>
    </select>
  );
}

function NeueKategorie(props: { standardKonto: string }) {
  const [name, setName] = useState('');
  return (
    <form
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        aktualisiereBudgets((d) => ({ ...d, kategorien: [...d.kategorien, { id: neueId(), name: name.trim(), betrag: 0, konto: props.standardKonto }] }));
        setName('');
      }}
    >
      <input type="text" aria-label="Neuer Lebensbereich" placeholder="Neuer Lebensbereich" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: '1 1 200px', width: 'auto' }} />
      <button type="submit" className="btn" disabled={!name.trim()}>
        + Hinzufügen
      </button>
    </form>
  );
}

function AusgabenKarte() {
  const data = useAppData();
  const budgets = useBudgets();
  const kontext = kontextAus(data);
  const [betrag, setBetrag] = useState<number | null>(null);
  const [kategorie, setKategorie] = useState(budgets.kategorien[0]?.id ?? '');
  const [datum, setDatum] = useState(clock().heute());
  const [notiz, setNotiz] = useState('');
  // Neuer Schlüssel leert das Betragsfeld nach dem Speichern.
  const [formKey, setFormKey] = useState(0);

  const kat = budgets.kategorien.find((k) => k.id === kategorie) ?? budgets.kategorien[0];
  const imZeitraum = budgets.ausgaben
    .filter((a) => a.datum >= kontext.letzterGehaltstag)
    .sort((a, b) => (a.datum === b.datum ? (a.erfasstAm < b.erfasstAm ? 1 : -1) : a.datum < b.datum ? 1 : -1));
  const name = (id: string) => budgets.kategorien.find((k) => k.id === id)?.name ?? 'gelöschter Bereich';

  return (
    <Karte titel="Ausgabe erfassen">
      <form
        className="formular"
        onSubmit={(e) => {
          e.preventDefault();
          if (!betrag || !kat) return;
          aktualisiereBudgets((d) =>
            neueAusgabe(d, { kategorie: kat.id, betrag, datum, konto: kat.konto, notiz: notiz.trim() || undefined, erfasstAm: clock().jetzt() }),
          );
          setBetrag(null);
          setNotiz('');
          setFormKey((k) => k + 1);
        }}
      >
        <div className="formular-raster">
          <Feld label="Betrag">{(id) => <GeldInput key={formKey} id={id} value={betrag} onChange={setBetrag} />}</Feld>
          <Feld label="Lebensbereich">
            {(id) => (
              <select id={id} value={kat?.id ?? ''} onChange={(e) => setKategorie(e.target.value)}>
                {budgets.kategorien.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            )}
          </Feld>
          <Feld label="Datum">{(id) => <input id={id} type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />}</Feld>
          <Feld label="Notiz (optional)">{(id) => <input id={id} type="text" value={notiz} onChange={(e) => setNotiz(e.target.value)} />}</Feld>
        </div>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!betrag || !kat}>
          Ausgabe speichern
        </button>
        <p className="hinweis">Du musst nicht jede Ausgabe erfassen: Beim Kontoabgleich kannst du die Differenz auch gesammelt einem Bereich zuordnen.</p>
      </form>

      <h3 style={{ fontSize: 15 }}>Seit {formatLong(kontext.letzterGehaltstag)}</h3>
      {imZeitraum.length === 0 ? (
        <Leer>Noch keine Ausgaben in diesem Budgetmonat.</Leer>
      ) : (
        <ul className="liste">
          {imZeitraum.map((a) => (
            <li key={a.id}>
              <span className="datum">{formatShort(a.datum)}</span>
              <span className="text">
                <span>{name(a.kategorie)}</span>
                {a.notiz && <span className="hinweis">{a.notiz}</span>}
              </span>
              <Betrag cents={-a.betrag} vorzeichen />
              <button
                type="button"
                className="btn btn-ghost btn-klein btn-danger"
                aria-label="Ausgabe löschen"
                onClick={() => aktualisiereBudgets((d) => ({ ...d, ausgaben: d.ausgaben.filter((x) => x.id !== a.id) }))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </Karte>
  );
}
