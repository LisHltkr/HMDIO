import { useEffect, useRef, useState, type FormEvent } from 'react';
import { store } from '../core';
import { fallschirmAblage } from '../storage/ablagen';
import type { Sync, SyncStatus } from '../storage/sync';
import { Feld, Karte, SeitenKopf } from '../ui';
import { dateiname, exportieren, sicherungLesen } from './sicherung';
import { datenUebernehmen, jetztAbgleichen, lokalerText, meldungAus, statusKurz, useSyncStatus } from './sync';
import { KonfliktWahl } from './SyncHinweis';

/** Seite „Sicherung & Sync“: Daten als Datei sichern/einlesen und Geräte verschlüsselt abgleichen. */
export function SicherungSeite(props: { sync: Sync; speicherort: string }) {
  return (
    <>
      <SeitenKopf titel="Sicherung & Sync" untertitel={`Daten: ${props.speicherort}`} />
      <div className="raster">
        <SyncKarte sync={props.sync} />
        <SicherungKarte />
      </div>
    </>
  );
}

type Meldung = { text: string; fehler?: boolean } | null;

function SicherungKarte() {
  const [meldung, setMeldung] = useState<Meldung>(null);
  const [fallschirm, setFallschirm] = useState<string | null>(null);
  const eingabe = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fallschirmAblage().lesen().then(setFallschirm).catch(() => setFallschirm(null));
  }, [meldung]);

  async function ausfuehren(tun: () => Promise<string>) {
    try {
      setMeldung({ text: await tun() });
    } catch (e) {
      setMeldung({ text: meldungAus(e), fehler: true });
    }
  }

  async function einlesen(datei: File): Promise<string> {
    const daten = await sicherungLesen(datei);
    if (!window.confirm('Alle Daten auf diesem Gerät durch die Sicherung ersetzen? Der bisherige Stand wird vorher als Fallschirm aufgehoben.')) {
      return 'Nichts geändert.';
    }
    await fallschirmAblage().schreiben(lokalerText());
    store().set(daten);
    return `Sicherung „${datei.name}“ eingelesen.`;
  }

  return (
    <Karte titel="Sicherung">
      <p className="gedaempft">
        Eine Sicherung ist eine Datei mit allen deinen Daten, <strong>unverschlüsselt</strong>. Leg sie an einen sicheren
        Ort, zum Beispiel in iCloud Drive oder auf einen USB-Stick.
      </p>
      <div className="aktionen">
        <button type="button" className="btn btn-primary" onClick={() => void ausfuehren(() => exportieren(lokalerText()))}>
          Sicherung exportieren
        </button>
        <button type="button" className="btn" onClick={() => eingabe.current?.click()}>
          Sicherung einlesen
        </button>
        <input
          ref={eingabe}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const datei = e.target.files?.[0];
            e.target.value = '';
            if (datei) void ausfuehren(() => einlesen(datei));
          }}
        />
      </div>
      {fallschirm && (
        <div className="infobox sync-hinweis">
          <span>Fallschirm: Der Stand vor der letzten Ersetzung ist aufgehoben.</span>
          <button type="button" className="btn btn-klein" onClick={() => void ausfuehren(() => exportieren(fallschirm, dateiname('fallschirm')))}>
            Als Datei sichern
          </button>
        </div>
      )}
      {meldung && (
        <p className={meldung.fehler ? 'fehlerbox' : 'infobox'} role="status">
          {meldung.text}
        </p>
      )}
    </Karte>
  );
}

function SyncKarte(props: { sync: Sync }) {
  const status = useSyncStatus(props.sync);
  if (status.art === 'aus') return <SyncEinrichten sync={props.sync} />;
  if (status.art === 'gesperrt') return <SyncEntsperren sync={props.sync} />;
  return <SyncLaeuft sync={props.sync} status={status} />;
}

function SyncEinrichten(props: { sync: Sync }) {
  const [art, setArt] = useState<'neu' | 'beitreten'>('neu');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [arbeitet, setArbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler(null);
    if (art === 'neu' && passwort !== wiederholung) return setFehler('Die beiden Passwörter sind nicht gleich.');
    if (
      art === 'beitreten' &&
      !window.confirm('Die Daten auf diesem Gerät werden durch die vom Server ersetzt. Der bisherige Stand wird als Fallschirm aufgehoben. Weiter?')
    ) {
      return;
    }
    setArbeitet(true);
    try {
      if (art === 'neu') await props.sync.einrichtenNeu({ url, token }, passwort, lokalerText());
      else datenUebernehmen(props.sync, await props.sync.einrichtenBeitreten({ url, token }, passwort, lokalerText()));
    } catch (err) {
      setFehler(meldungAus(err));
    } finally {
      setArbeitet(false);
    }
  }

  return (
    <Karte titel="Sync zwischen deinen Geräten">
      <p className="gedaempft">
        Hält Laptop und iPhone auf demselben Stand, über deinen Sync-Server (z. B. deinen Pi). Verschlüsselt wird hier auf
        dem Gerät mit deinem Passwort; der Server sieht nur Datensalat.
      </p>
      <div className="tabs" role="tablist" aria-label="Art der Einrichtung">
        <button type="button" role="tab" aria-selected={art === 'neu'} onClick={() => setArt('neu')}>
          Erstes Gerät
        </button>
        <button type="button" role="tab" aria-selected={art === 'beitreten'} onClick={() => setArt('beitreten')}>
          Weiteres Gerät
        </button>
      </div>
      <p className="hinweis">
        {art === 'neu'
          ? 'Dieses Gerät hat deine Daten und legt damit den Tresor auf dem Server an.'
          : 'Dieses Gerät holt die Daten vom Server; seine bisherigen Daten werden ersetzt.'}
      </p>
      <form className="formular" onSubmit={absenden}>
        <Feld label="Adresse des Sync-Servers" hinweis="z. B. https://finanz-pi.dein-tailnet.ts.net">
          {(id) => (
            <input id={id} type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={url} onChange={(e) => setUrl(e.target.value)} />
          )}
        </Feld>
        <Feld label="Zugangsschlüssel" hinweis="der Inhalt von token.txt auf dem Pi">
          {(id) => (
            <input id={id} type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={token} onChange={(e) => setToken(e.target.value)} />
          )}
        </Feld>
        <Feld
          label="Sync-Passwort"
          hinweis={
            art === 'neu'
              ? 'Mindestens 12 Zeichen, am besten ein Satz. Ohne dieses Passwort lässt sich der Tresor nie wieder öffnen – speichere es im Passwortmanager.'
              : 'Das Passwort, mit dem das erste Gerät den Tresor angelegt hat.'
          }
        >
          {(id) => (
            <input id={id} type="password" autoComplete={art === 'neu' ? 'new-password' : 'current-password'} required value={passwort} onChange={(e) => setPasswort(e.target.value)} />
          )}
        </Feld>
        {art === 'neu' && (
          <Feld label="Passwort wiederholen">
            {(id) => <input id={id} type="password" autoComplete="new-password" required value={wiederholung} onChange={(e) => setWiederholung(e.target.value)} />}
          </Feld>
        )}
        {fehler && (
          <p className="fehlerbox" role="alert">
            {fehler}
          </p>
        )}
        <div className="aktionen">
          <button type="submit" className="btn btn-primary" disabled={arbeitet}>
            {arbeitet ? 'Einen Moment …' : art === 'neu' ? 'Tresor anlegen' : 'Verbinden'}
          </button>
        </div>
      </form>
    </Karte>
  );
}

function SyncEntsperren(props: { sync: Sync }) {
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [arbeitet, setArbeitet] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setArbeitet(true);
    setFehler(null);
    try {
      await props.sync.entsperren(passwort);
      await jetztAbgleichen(props.sync);
    } catch (err) {
      setFehler(meldungAus(err));
    } finally {
      setArbeitet(false);
    }
  }

  return (
    <Karte titel="Sync gesperrt">
      <p className="gedaempft">
        Auf diesem Gerät fehlt der Schlüssel, zum Beispiel nach dem Löschen der Browserdaten. Gib dein Sync-Passwort ein, um
        weiterzumachen.
      </p>
      <form className="formular" onSubmit={absenden}>
        <Feld label="Sync-Passwort">
          {(id) => <input id={id} type="password" autoComplete="current-password" required value={passwort} onChange={(e) => setPasswort(e.target.value)} />}
        </Feld>
        {fehler && (
          <p className="fehlerbox" role="alert">
            {fehler}
          </p>
        )}
        <div className="aktionen">
          <button type="submit" className="btn btn-primary" disabled={arbeitet}>
            Entsperren
          </button>
          <AusschaltenKnopf sync={props.sync} />
        </div>
      </form>
    </Karte>
  );
}

function SyncLaeuft(props: { sync: Sync; status: SyncStatus }) {
  const { sync, status } = props;
  const [arbeitet, setArbeitet] = useState(false);

  async function abgleichen() {
    setArbeitet(true);
    try {
      await jetztAbgleichen(sync);
    } finally {
      setArbeitet(false);
    }
  }

  return (
    <Karte titel="Sync zwischen deinen Geräten">
      <dl className="rechnung">
        <div>
          <dt>Server</dt>
          <dd className="klein">{sync.adresse()}</dd>
        </div>
        <div className="summe">
          <dt>Zustand</dt>
          <dd>{statusKurz(status)}</dd>
        </div>
      </dl>
      {status.art === 'offline' && <p className="hinweisbox">{status.meldung}</p>}
      {status.art === 'fehler' && (
        <p className="fehlerbox" role="alert">
          {status.meldung}
        </p>
      )}
      {status.art === 'konflikt' && <KonfliktWahl sync={sync} />}
      <div className="aktionen">
        <button type="button" className="btn btn-primary" disabled={arbeitet || status.art === 'konflikt'} onClick={() => void abgleichen()}>
          Jetzt synchronisieren
        </button>
        <AusschaltenKnopf sync={sync} />
      </div>
      <p className="hinweis">
        Ausschalten trennt nur dieses Gerät: Deine Daten hier bleiben, der Tresor auf dem Server auch.
      </p>
    </Karte>
  );
}

function AusschaltenKnopf(props: { sync: Sync }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-danger"
      onClick={() => {
        if (window.confirm('Sync auf diesem Gerät ausschalten? Deine Daten hier bleiben, der Tresor auf dem Server auch.')) {
          void props.sync.ausschalten();
        }
      }}
    >
      Sync ausschalten
    </button>
  );
}
