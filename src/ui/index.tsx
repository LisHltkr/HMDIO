import { useEffect, useId, useState, type ReactNode } from 'react';
import { formatEuro, formatSigned, parseEuro, toInputValue, type Cents } from '../core';

/** Gemeinsame Oberflächen-Bausteine. Darf nur `core` importieren. */

export function SeitenKopf(props: { titel: string; untertitel?: ReactNode; aktionen?: ReactNode }) {
  return (
    <header className="seitenkopf">
      <div>
        <h1>{props.titel}</h1>
        {props.untertitel && <p className="gedaempft">{props.untertitel}</p>}
      </div>
      {props.aktionen && <div className="aktionen">{props.aktionen}</div>}
    </header>
  );
}

export function Karte(props: { titel?: ReactNode; aktion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={'karte ' + (props.className ?? '')}>
      {(props.titel || props.aktion) && (
        <div className="karte-kopf">
          {props.titel && <h2>{props.titel}</h2>}
          {props.aktion}
        </div>
      )}
      {props.children}
    </section>
  );
}

export function Betrag(props: { cents: Cents; vorzeichen?: boolean; className?: string }) {
  return (
    <span className={'betrag ' + (props.className ?? '')}>
      {props.vorzeichen ? formatSigned(props.cents) : formatEuro(props.cents)}
    </span>
  );
}

/** Beschriftetes Formularfeld; das Kind bekommt die passende id. */
export function Feld(props: { label: string; hinweis?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="feld">
      <label htmlFor={id}>{props.label}</label>
      {props.children(id)}
      {props.hinweis && <span className="hinweis">{props.hinweis}</span>}
    </div>
  );
}

/** Eingabe für Euro-Beträge. Meldet null, solange die Eingabe kein gültiger Betrag ist. */
export function GeldInput(props: {
  id?: string;
  value: Cents | null;
  onChange: (cents: Cents | null) => void;
  erlaubeNegativ?: boolean;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(props.value === null ? '' : toInputValue(props.value));
  const parsed = parseEuro(text);
  const ungueltig = text !== '' && (parsed === null || (!props.erlaubeNegativ && parsed < 0));

  // Von außen geänderte Werte übernehmen, ohne die laufende Eingabe zu stören.
  useEffect(() => {
    if (props.value !== parsed) setText(props.value === null ? '' : toInputValue(props.value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value]);

  return (
    <div className="geld-input">
      <input
        id={props.id}
        type="text"
        inputMode="decimal"
        value={text}
        placeholder="0,00"
        aria-invalid={ungueltig}
        autoFocus={props.autoFocus}
        onChange={(e) => {
          setText(e.target.value);
          const c = parseEuro(e.target.value);
          props.onChange(c === null || (!props.erlaubeNegativ && c < 0) ? null : c);
        }}
      />
      <span aria-hidden="true">€</span>
    </div>
  );
}

export function Fortschritt(props: { anteil: number; ton?: 'gut' | 'warnung' | 'neutral'; label: string }) {
  const prozent = Math.max(0, Math.min(1, props.anteil)) * 100;
  return (
    <div className="fortschritt" role="progressbar" aria-label={props.label} aria-valuenow={Math.round(prozent)} aria-valuemin={0} aria-valuemax={100}>
      <div className={'fortschritt-balken ton-' + (props.ton ?? 'gut')} style={{ width: `${prozent}%` }} />
    </div>
  );
}

export function Dialog(props: { titel: string; onClose: () => void; children: ReactNode; breit?: boolean }) {
  const id = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.onClose]);
  return (
    <div className="dialog-hintergrund" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={id} className={'dialog' + (props.breit ? ' breit' : '')}>
        <div className="dialog-kopf">
          <h2 id={id}>{props.titel}</h2>
          <button type="button" className="btn btn-ghost" aria-label="Schließen" onClick={props.onClose}>
            ✕
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

export function Leer(props: { children: ReactNode }) {
  return <p className="leer">{props.children}</p>;
}

export function Kennzahl(props: { label: string; children: ReactNode; ton?: 'gut' | 'warnung' }) {
  return (
    <div className={'kennzahl' + (props.ton ? ' ton-' + props.ton : '')}>
      <span className="kennzahl-label">{props.label}</span>
      <span className="kennzahl-wert">{props.children}</span>
    </div>
  );
}
