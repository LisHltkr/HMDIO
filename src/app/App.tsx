import { useEffect, useState } from 'react';
import { alleModule, store } from '../core';

const SEITE_KEY = 'finanz-cockpit/seite';

export function App(props: { speicherort: string }) {
  const seiten = alleModule()
    .flatMap((m) => m.seiten ?? [])
    .sort((a, b) => a.reihenfolge - b.reihenfolge);
  const [aktiv, setAktiv] = useState(() => {
    try {
      return localStorage.getItem(SEITE_KEY) ?? seiten[0]?.id;
    } catch {
      return seiten[0]?.id;
    }
  });
  const seite = seiten.find((s) => s.id === aktiv) ?? seiten[0];

  useEffect(() => {
    try {
      if (seite) localStorage.setItem(SEITE_KEY, seite.id);
    } catch {
      // Merken der Seite ist nur Komfort.
    }
  }, [seite]);

  return (
    <div className="app">
      <nav className="nav" aria-label="Hauptnavigation">
        <div className="nav-marke">
          <strong>Finanz-Cockpit</strong>
          <span>Wie viel gehört mir wirklich?</span>
        </div>
        <ul>
          {seiten.map((s) => (
            <li key={s.id}>
              <button type="button" aria-current={s.id === seite?.id ? 'page' : undefined} onClick={() => setAktiv(s.id)}>
                {s.titel}
              </button>
            </li>
          ))}
        </ul>
        <div className="nav-fuss" title="Hier liegen deine Daten">
          Daten: {props.speicherort}
        </div>
      </nav>
      <main className="inhalt">{seite && <seite.Komponente key={seite.id} />}</main>
    </div>
  );
}

/** Speichert jede Änderung kurz verzögert, damit schnelles Tippen nicht jedes Mal schreibt. */
export function autoSpeichern(save: () => Promise<void>, onFehler: (e: unknown) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = store().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => save().catch(onFehler), 400);
  });
  const sofort = () => {
    if (timer) {
      clearTimeout(timer);
      save().catch(onFehler);
    }
  };
  window.addEventListener('beforeunload', sofort);
  return () => {
    unsubscribe();
    window.removeEventListener('beforeunload', sofort);
  };
}
