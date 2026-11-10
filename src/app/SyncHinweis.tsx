import { useState } from 'react';
import type { Sync } from '../storage/sync';
import { datenUebernehmen, lokalerText, meldungAus, statusKurz, useSyncStatus } from './sync';

/** Hinweis über jeder Seite, wenn der Sync eine Entscheidung oder Aufmerksamkeit braucht. */
export function SyncHinweis(props: { sync: Sync; oeffnen: () => void }) {
  const status = useSyncStatus(props.sync);
  if (status.art === 'konflikt') return <KonfliktWahl sync={props.sync} />;
  if (status.art !== 'gesperrt' && status.art !== 'fehler') return null;
  return (
    <div className="hinweisbox sync-hinweis" role="status">
      <span>{status.art === 'gesperrt' ? 'Sync ist auf diesem Gerät gesperrt – es fehlt dein Sync-Passwort.' : status.meldung}</span>
      <button type="button" className="btn btn-klein" onClick={props.oeffnen}>
        Zu „Sicherung &amp; Sync“
      </button>
    </div>
  );
}

/** Kurzer Zustand für den Fuß der Navigation. */
export function SyncKurz(props: { sync: Sync }) {
  const status = useSyncStatus(props.sync);
  return status.art === 'aus' ? null : <span className="sync-kurz">{statusKurz(status)}</span>;
}

/** Konflikt: Zwei Geräte haben unabhängig gespeichert. Die Person entscheidet, nichts geht verloren. */
export function KonfliktWahl(props: { sync: Sync }) {
  const [arbeitet, setArbeitet] = useState(false);

  async function waehlen(wahl: 'server' | 'meine') {
    setArbeitet(true);
    try {
      const neu = await props.sync.konfliktLoesen(wahl, lokalerText());
      if (neu) datenUebernehmen(props.sync, neu);
    } catch (e) {
      props.sync.melden(meldungAus(e));
    } finally {
      setArbeitet(false);
    }
  }

  return (
    <div className="hinweisbox konflikt" role="alert">
      <p>
        <strong>Ein anderes Gerät hat inzwischen gespeichert.</strong> Welcher Stand soll gelten? Der andere wird als
        Fallschirm aufgehoben (unter „Sicherung &amp; Sync“).
      </p>
      <div className="aktionen">
        <button type="button" className="btn" disabled={arbeitet} onClick={() => void waehlen('server')}>
          Stand vom anderen Gerät
        </button>
        <button type="button" className="btn" disabled={arbeitet} onClick={() => void waehlen('meine')}>
          Stand dieses Geräts
        </button>
      </div>
    </div>
  );
}
