import { useState } from 'react';
import { daysBetween, formatLong, formatMonth, formatShort, sum, useAppData, wirkung, type Termin } from '../../core';
import { Betrag, Fortschritt, Karte, Leer, SeitenKopf } from '../../ui';
import { budgetStaende, budgetsAus } from '../budgets';
import { AbgleichDialog, KONTO_ART_LABEL, ausblickFuer, istEingetragen, kontenAus, kontextAus } from '../konten';
import { ART_LABEL, PostenDialog, ruecklagenSoll, zahlungenAus } from '../zahlungen';

/** Gruppen für die Herleitung von „wirklich verfügbar“. */
const GRUPPEN: { id: string; label: string; arten: string[]; farbe: string }[] = [
  { id: 'fix', label: 'Fixkosten & Rücklagen', arten: ['fixkosten', 'ruecklage'], farbe: 'var(--fix)' },
  { id: 'rechnung', label: 'Rechnungen', arten: ['rechnung'], farbe: 'var(--warnung)' },
  { id: 'sparen', label: 'Sparen & Umbuchungen', arten: ['umbuchung'], farbe: '#4f7f9f' },
];

export function UebersichtSeite() {
  const data = useAppData();
  const { konten, gehalt } = kontenAus(data);
  const kontext = kontextAus(data);
  const [abgleich, setAbgleich] = useState<string | null>(null);
  const [neueRechnung, setNeueRechnung] = useState(false);

  const giro = konten.find((k) => k.id === gehalt.konto) ?? konten[0];
  if (!giro) return <Leer>Lege unter „Konten“ ein Konto an.</Leer>;

  const a = ausblickFuer(data, giro, kontext);
  const tage = Math.max(1, daysBetween(kontext.heute, kontext.naechsterGehaltstag));
  const verplant = a.abgaenge - a.zugaenge + a.reserviert;
  const abgaengeVon = (arten: string[]) =>
    -sum(a.ausstehend.filter((t) => arten.includes(t.art)).map((t) => Math.min(0, wirkung(t, giro.id))));
  const bekannt = GRUPPEN.flatMap((g) => g.arten);
  const gruppen = [
    ...GRUPPEN.map((g) => ({ ...g, betrag: abgaengeVon(g.arten), anzahl: a.ausstehend.filter((t) => g.arten.includes(t.art) && wirkung(t, giro.id) < 0).length })),
    {
      id: 'sonst',
      label: 'Sonstige Abgänge',
      farbe: '#8b6bb0',
      arten: [],
      betrag: -sum(a.ausstehend.filter((t) => !bekannt.includes(t.art)).map((t) => Math.min(0, wirkung(t, giro.id)))),
      anzahl: 0,
    },
  ].filter((g) => g.betrag > 0);

  const basis = Math.max(a.effektiverStand + a.zugaenge, 1);
  const balken = [
    ...gruppen.map((g) => ({ label: g.label, farbe: g.farbe, betrag: g.betrag })),
    { label: 'Offene Budgets', farbe: 'var(--budget)', betrag: a.reserviert },
    { label: 'Frei', farbe: 'var(--akzent)', betrag: Math.max(0, a.verfuegbar) },
  ];

  const einrichtungFehlt = !istEingetragen(giro) || gehalt.betrag === 0;

  return (
    <>
      <SeitenKopf
        titel={formatMonth(kontext.heute)}
        untertitel={
          <>
            Heute, {formatLong(kontext.heute)} · nächster Gehaltseingang am {formatShort(kontext.naechsterGehaltstag)} (in {tage} {tage === 1 ? 'Tag' : 'Tagen'})
            {istEingetragen(giro) && <> · Kontostand von Hand eingetragen am {formatShort(giro.abgleich.datum)}</>}
          </>
        }
        aktionen={
          <>
            <button type="button" className="btn" onClick={() => setAbgleich(giro.id)}>
              Kontostand aktualisieren
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setNeueRechnung(true)}>
              + Rechnung planen
            </button>
          </>
        }
      />

      {einrichtungFehlt && (
        <p className="hinweisbox">
          Zum Start: Trag unter <strong>Konten</strong> dein Gehalt und die aktuellen Kontostände ein, unter{' '}
          <strong>Abbuchungen &amp; Fixkosten</strong> deine festen Kosten und Sparraten und unter <strong>Budgets</strong>, wie viel du je Lebensbereich ausgeben willst.
        </p>
      )}

      <Karte className="held">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="gedaempft" style={{ fontSize: 15, fontWeight: 600 }}>
            Wirklich verfügbar bis {formatShort(kontext.naechsterGehaltstag)}
          </h2>
          <div className={'held-zahl' + (a.verfuegbar < 0 ? ' negativ' : '')}>
            <Betrag cents={a.verfuegbar} />
          </div>
          <p className="gedaempft">
            {a.verfuegbar >= 0 ? (
              <>≈ <Betrag cents={Math.floor(a.verfuegbar / tage)} /> pro Tag bis zum nächsten Gehalt</>
            ) : (
              'Achtung: Bis zum Gehalt reicht das Geld auf diesem Konto nicht für alles, was geplant ist.'
            )}
          </p>
          {verplant > 0 && (
            <p className="hinweisbox">
              Dein {giro.name} zeigt <strong><Betrag cents={a.effektiverStand} /></strong> – davon sind <strong><Betrag cents={verplant} /></strong> schon verplant, aber noch nicht abgebucht.
            </p>
          )}
          <div
            role="img"
            aria-label={balken.map((b) => `${b.label} ${Math.round((b.betrag / basis) * 100)} %`).join(', ')}
            style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', background: 'var(--rand)', marginTop: 8 }}
          >
            {balken.map((b) => (
              <div key={b.label} style={{ width: `${(b.betrag / basis) * 100}%`, background: b.farbe }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }} className="gedaempft klein" aria-hidden="true">
            {balken.filter((b) => b.betrag > 0).map((b) => (
              <span key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: b.farbe }} />
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <dl className="rechnung">
          <div>
            <dt style={{ color: 'var(--tinte)' }}>Kontostand ({istEingetragen(giro) ? `von Hand, ${formatShort(giro.abgleich.datum)}` : 'noch nicht eingetragen'})</dt>
            <dd><Betrag cents={giro.abgleich.stand} /></dd>
          </div>
          {a.effektiverStand !== giro.abgleich.stand && (
            <div>
              <dt>− seither erfasste Ausgaben</dt>
              <dd><Betrag cents={a.effektiverStand - giro.abgleich.stand} vorzeichen /></dd>
            </div>
          )}
          {gruppen.map((g) => (
            <div key={g.id}>
              <dt>− Noch ausstehend: {g.label}{g.anzahl ? ` (${g.anzahl})` : ''}</dt>
              <dd><Betrag cents={-g.betrag} vorzeichen /></dd>
            </div>
          ))}
          {a.zugaenge > 0 && (
            <div>
              <dt>+ Noch ausstehende Zugänge</dt>
              <dd><Betrag cents={a.zugaenge} vorzeichen /></dd>
            </div>
          )}
          <div>
            <dt>− Noch offene Budgets</dt>
            <dd><Betrag cents={-a.reserviert} vorzeichen /></dd>
          </div>
          <div className="summe">
            <dt>= Frei verfügbar</dt>
            <dd><Betrag cents={a.verfuegbar} className={a.verfuegbar < 0 ? 'negativ' : 'positiv'} /></dd>
          </div>
        </dl>
      </Karte>

      <div className="raster">
        <Karte titel="Noch ausstehend bis zum Gehalt">
          {a.ausstehend.length === 0 ? (
            <Leer>Bis zum nächsten Gehalt geht nichts Geplantes mehr ab.</Leer>
          ) : (
            <ul className="liste">
              {a.ausstehend.map((t) => (
                <TerminZeile key={t.key} termin={t} konto={giro.id} ueberfaellig={t.datum <= giro.abgleich.datum} />
              ))}
            </ul>
          )}
        </Karte>

        <BudgetKarte />
        <WeitereKonten />
      </div>

      {abgleich && <AbgleichDialog kontoId={abgleich} onClose={() => setAbgleich(null)} />}
      {neueRechnung && <PostenDialog vorlage="rechnung" onClose={() => setNeueRechnung(false)} />}
    </>
  );
}

function TerminZeile(props: { termin: Termin; konto: string; ueberfaellig: boolean }) {
  const t = props.termin;
  return (
    <li>
      <span className="datum">{formatShort(t.datum)}</span>
      <span className="text">
        <span>{t.bezeichnung}</span>
        <span className={'etikett art-' + t.art}>
          {ART_LABEL[t.art] ?? t.art}
          {props.ueberfaellig && ' · fällig, noch nicht abgegangen'}
        </span>
      </span>
      <Betrag cents={wirkung(t, props.konto)} vorzeichen />
    </li>
  );
}

function BudgetKarte() {
  const data = useAppData();
  const staende = budgetStaende(budgetsAus(data), kontextAus(data)).filter((s) => s.kategorie.betrag > 0 || s.ausgegeben > 0);
  return (
    <Karte titel="Budgets in diesem Gehaltsmonat">
      {staende.length === 0 ? (
        <Leer>Noch keine Budgets geplant.</Leer>
      ) : (
        staende.map((s) => (
          <div key={s.kategorie.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 15 }}>
              <span style={{ fontWeight: 500 }}>{s.kategorie.name}</span>
              <span>
                <strong><Betrag cents={s.rest} /></strong> <span className="gedaempft">übrig von <Betrag cents={s.kategorie.betrag} /></span>
              </span>
            </div>
            <Fortschritt
              label={`${s.kategorie.name}: verbraucht`}
              anteil={s.kategorie.betrag ? s.ausgegeben / s.kategorie.betrag : 1}
              ton={s.ausgegeben >= s.kategorie.betrag ? 'warnung' : 'gut'}
            />
          </div>
        ))
      )}
    </Karte>
  );
}

function WeitereKonten() {
  const data = useAppData();
  const { konten, gehalt } = kontenAus(data);
  const kontext = kontextAus(data);
  const zahlungen = zahlungenAus(data);
  const staende = konten.map((k) => ({ konto: k, ausblick: ausblickFuer(data, k, kontext) }));
  const gesamt = sum(staende.map((s) => s.ausblick.effektiverStand));
  return (
    <Karte titel="Alle Konten" aktion={<span className="gedaempft">Gesamt <Betrag cents={gesamt} /></span>}>
      <ul className="liste">
        {staende
          .filter((s) => s.konto.id !== gehalt.konto)
          .map(({ konto, ausblick }) => {
            const soll = sum(ruecklagenSoll(zahlungen, konto.id, kontext.heute).map((r) => r.soll));
            const prognose = ausblick.effektiverStand - ausblick.abgaenge + ausblick.zugaenge;
            return (
              <li key={konto.id}>
                <span className="text">
                  <span style={{ fontWeight: 500 }}>{konto.name}</span>
                  <span className="hinweis">
                    {konto.name !== KONTO_ART_LABEL[konto.art] ? KONTO_ART_LABEL[konto.art] : 'Stand'}
                    {prognose !== ausblick.effektiverStand && (
                      <> · am {formatShort(kontext.naechsterGehaltstag)}: <Betrag cents={prognose} className={prognose < 0 ? 'negativ' : ''} /></>
                    )}
                    {soll > 0 && (
                      <>
                        {' · '}
                        <span style={{ color: ausblick.effektiverStand < soll ? 'var(--warnung-text)' : undefined }}>
                          Rücklagen-Soll <Betrag cents={soll} />
                        </span>
                      </>
                    )}
                  </span>
                </span>
                <Betrag cents={ausblick.effektiverStand} />
              </li>
            );
          })}
      </ul>
    </Karte>
  );
}
