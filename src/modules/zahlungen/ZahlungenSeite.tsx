import { useState } from 'react';
import { RHYTHMUS_LABEL, clock, formatShort, formatLong, monthlyEquivalent, sum } from '../../core';
import { Betrag, Karte, Leer, SeitenKopf } from '../../ui';
import { useKonten } from '../konten';
import { PostenDialog } from './PostenDialog';
import { ART_LABEL, aktualisiereZahlungen, naechsterTermin, postenArt, useZahlungen, type Posten } from './model';

type Tab = 'wiederkehrend' | 'einmalig';

export function ZahlungenSeite() {
  const { posten } = useZahlungen();
  const { konten } = useKonten();
  const heute = clock().heute();
  const [tab, setTab] = useState<Tab>('wiederkehrend');
  const [dialog, setDialog] = useState<{ posten?: Posten; vorlage?: 'rechnung' | 'umbuchung' } | null>(null);

  const kontoName = (id?: string) => konten.find((k) => k.id === id)?.name ?? '–';
  const wiederkehrend = posten.filter((p) => p.rhythmus !== 'einmalig');
  const einmalig = posten
    .filter((p) => p.rhythmus === 'einmalig')
    .sort((a, b) => (a.start < b.start ? -1 : 1));
  const kommendeRechnungen = einmalig.filter((p) => p.start >= heute);

  function loeschen(p: Posten) {
    if (window.confirm(`„${p.name}“ wirklich löschen?`)) {
      aktualisiereZahlungen((d) => ({ posten: d.posten.filter((x) => x.id !== p.id) }));
    }
  }

  const aktionen = (p: Posten) => (
    <td className="rechts" style={{ whiteSpace: 'nowrap' }}>
      <button type="button" className="btn btn-ghost btn-klein" onClick={() => setDialog({ posten: p })}>
        Bearbeiten
      </button>
      <button type="button" className="btn btn-ghost btn-klein btn-danger" onClick={() => loeschen(p)} aria-label={`${p.name} löschen`}>
        Löschen
      </button>
    </td>
  );

  return (
    <>
      <SeitenKopf
        titel="Abbuchungen & Fixkosten"
        untertitel="Alles, was künftig von deinen Konten abgeht – wiederkehrend oder einmalig"
        aktionen={
          <>
            <button type="button" className="btn" onClick={() => setDialog({ vorlage: 'umbuchung' })}>
              + Sparrate / Umbuchung
            </button>
            <button type="button" className="btn" onClick={() => setDialog({ vorlage: 'rechnung' })}>
              + Rechnung
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setDialog({})}>
              + Fixkosten
            </button>
          </>
        }
      />

      <div className="tabs" role="tablist" aria-label="Ansicht" style={{ alignSelf: 'flex-start' }}>
        <button type="button" role="tab" aria-selected={tab === 'wiederkehrend'} onClick={() => setTab('wiederkehrend')}>
          Wiederkehrend ({wiederkehrend.length})
        </button>
        <button type="button" role="tab" aria-selected={tab === 'einmalig'} onClick={() => setTab('einmalig')}>
          Einmalige Rechnungen ({kommendeRechnungen.length})
        </button>
      </div>

      {tab === 'wiederkehrend' ? (
        <Karte
          titel="Wiederkehrende Posten"
          aktion={
            <span className="gedaempft">
              ≈ <Betrag cents={sum(wiederkehrend.map((p) => monthlyEquivalent(p.betrag, p.rhythmus)))} /> pro Monat
            </span>
          }
        >
          {wiederkehrend.length === 0 ? (
            <Leer>Noch keine Fixkosten. Leg z. B. Miete, Strom, Versicherungen und deine Sparraten an.</Leer>
          ) : (
            <div className="tabelle-box">
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th scope="col">Bezeichnung</th>
                    <th scope="col">Konto</th>
                    <th scope="col">Rhythmus</th>
                    <th scope="col">Nächste</th>
                    <th scope="col" className="rechts">Betrag</th>
                    <th scope="col" className="rechts">≈ / Monat</th>
                    <th scope="col"><span className="sr-only">Aktionen</span></th>
                  </tr>
                </thead>
                <tbody>
                  {wiederkehrend.map((p) => {
                    const naechste = naechsterTermin(p, heute);
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong style={{ fontWeight: 500 }}>{p.name}</strong>
                          <span className="unterzeile">
                            <span className={'etikett art-' + postenArt(p)}>{ART_LABEL[postenArt(p)]}</span> · {p.kategorie}
                          </span>
                        </td>
                        <td>
                          {kontoName(p.vonKonto)}
                          {p.nachKonto && <> → {kontoName(p.nachKonto)}</>}
                          {p.ruecklage && <span className="unterzeile">Rücklage auf {kontoName(p.ruecklage.konto)}</span>}
                        </td>
                        <td className="gedaempft">{RHYTHMUS_LABEL[p.rhythmus]}</td>
                        <td className="gedaempft">{naechste ? formatShort(naechste) : 'beendet'}</td>
                        <td className="rechts"><Betrag cents={p.betrag} /></td>
                        <td className="rechts"><Betrag cents={monthlyEquivalent(p.betrag, p.rhythmus)} className="gedaempft" /></td>
                        {aktionen(p)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Karte>
      ) : (
        <Karte titel="Einmalige Rechnungen" aktion={<span className="gedaempft">Offen <Betrag cents={sum(kommendeRechnungen.map((p) => p.betrag))} /></span>}>
          {einmalig.length === 0 ? (
            <Leer>Keine geplanten Rechnungen. Trag hier z. B. Arztrechnungen, Geschenke oder Reparaturen ein.</Leer>
          ) : (
            <div className="tabelle-box">
              <table style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th scope="col">Fällig</th>
                    <th scope="col">Bezeichnung</th>
                    <th scope="col">Konto</th>
                    <th scope="col" className="rechts">Betrag</th>
                    <th scope="col"><span className="sr-only">Aktionen</span></th>
                  </tr>
                </thead>
                <tbody>
                  {einmalig.map((p) => (
                    <tr key={p.id} style={p.start < heute ? { opacity: 0.6 } : undefined}>
                      <td className="gedaempft">{formatLong(p.start)}</td>
                      <td>
                        <strong style={{ fontWeight: 500 }}>{p.name}</strong>
                        <span className="unterzeile">{p.kategorie}</span>
                      </td>
                      <td>{kontoName(p.vonKonto)}</td>
                      <td className="rechts"><Betrag cents={p.betrag} /></td>
                      {aktionen(p)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Karte>
      )}

      {dialog && <PostenDialog posten={dialog.posten} vorlage={dialog.vorlage} onClose={() => setDialog(null)} />}
    </>
  );
}
