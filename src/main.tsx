import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DatenFehler, initStore, leereDaten, parseAppData, registriereModule, serializeAppData, store } from './core';
import { createStorage, laeuftInTauri } from './storage';
import { SYNC_KEY, fallschirmAblage, indexedDbSchluesselAblage, localStorageAblage } from './storage/ablagen';
import { createSync } from './storage/sync';
import { App, autoSpeichern } from './app/App';
import { MODULE } from './app/modules';
import { jetztAbgleichen } from './app/sync';
import './ui/styles.css';

async function start() {
  const root = createRoot(document.getElementById('root')!);
  registriereModule(MODULE);
  const storage = await createStorage();
  const sync = createSync({
    gemerkt: localStorageAblage(SYNC_KEY),
    schluessel: indexedDbSchluesselAblage(),
    fallschirm: fallschirmAblage(),
    fetch: (...args) => fetch(...args),
  });
  await sync.start().catch((e: unknown) => sync.melden(`Sync konnte nicht starten: ${String(e)}`));

  let text: string | null;
  try {
    text = await storage.load();
  } catch (e) {
    root.render(<Fehler titel="Datei konnte nicht gelesen werden" text={String(e)} ort={storage.beschreibung} />);
    return;
  }

  try {
    initStore(text ? parseAppData(text, MODULE) : leereDaten(MODULE));
  } catch (e) {
    const meldung = e instanceof DatenFehler ? e.message : String(e);
    // Nicht überschreiben: Die Datei bleibt unangetastet, bis das Problem gelöst ist.
    root.render(<Fehler titel="Deine Daten konnten nicht geladen werden" text={meldung} ort={storage.beschreibung} />);
    return;
  }

  if (!text) await storage.save(serializeAppData(store().get()));
  autoSpeichern(
    async () => {
      const aktuell = serializeAppData(store().get());
      await storage.save(aktuell); // lokal zuerst – der Sync darf das Speichern nie verhindern
      sync.geaendert(aktuell);
    },
    (e) => window.alert('Speichern fehlgeschlagen: ' + String(e)),
  );

  root.render(
    <StrictMode>
      <App speicherort={storage.beschreibung} sync={sync} />
    </StrictMode>,
  );

  // Abgleichen beim Start, wenn das Netz zurückkommt und wenn die App wieder in den Vordergrund kommt.
  const abgleichen = () => void jetztAbgleichen(sync);
  abgleichen();
  window.addEventListener('online', abgleichen);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') abgleichen();
    else void sync.leeren(); // vor dem Wegschalten noch senden: iOS friert Apps im Hintergrund ein
  });

  if (!laeuftInTauri()) webAppEinrichten();
}

/** Nur im Browser: Offline-Kopie der App (Service Worker) und dauerhafter Speicher (docs/entscheidungen/0004). */
function webAppEinrichten() {
  // Bittet den Browser, die Daten auch bei Speicherknappheit nicht zu löschen.
  navigator.storage?.persist?.().catch(() => undefined);
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    const basis = import.meta.env.BASE_URL;
    navigator.serviceWorker.register(`${basis}sw.js`, { scope: basis }).catch(() => undefined);
  }
}

function Fehler(props: { titel: string; text: string; ort: string }) {
  return (
    <div className="fehlerseite">
      <h1>{props.titel}</h1>
      <p>{props.text}</p>
      <p className="gedaempft">
        Daten: {props.ort}. Die App hat nichts verändert.
        {laeuftInTauri() && ' Im Ordner „backups“ daneben liegen die letzten Sicherungen.'}
      </p>
    </div>
  );
}

start();
