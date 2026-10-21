import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DatenFehler, initStore, leereDaten, parseAppData, registriereModule, serializeAppData, store } from './core';
import { createStorage } from './storage';
import { App, autoSpeichern } from './app/App';
import { MODULE } from './app/modules';
import './ui/styles.css';

async function start() {
  const root = createRoot(document.getElementById('root')!);
  registriereModule(MODULE);
  const storage = await createStorage();

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
    () => storage.save(serializeAppData(store().get())),
    (e) => window.alert('Speichern fehlgeschlagen: ' + String(e)),
  );

  root.render(
    <StrictMode>
      <App speicherort={storage.beschreibung} />
    </StrictMode>,
  );
}

function Fehler(props: { titel: string; text: string; ort: string }) {
  return (
    <div className="fehlerseite">
      <h1>{props.titel}</h1>
      <p>{props.text}</p>
      <p className="gedaempft">
        Datei: {props.ort}. Die App hat nichts verändert. Im Ordner „backups“ daneben liegen die letzten Sicherungen.
      </p>
    </div>
  );
}

start();
