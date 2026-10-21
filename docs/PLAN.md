# Finanz-Cockpit – Plan & Fachregeln

Leitfrage: **Wie viel Geld auf dem Girokonto gehört mir bis zum nächsten Gehalt wirklich?**

## Konten

| Konto      | Zweck                                                        |
|------------|--------------------------------------------------------------|
| Giro       | Gehalt kommt hier an, Alltag, Miete & monatliche Fixkosten   |
| Geldmarkt  | Rücklagen für jährliche / quartalsweise Kosten               |
| Sparkonto  | Puffer, Sparraten; einzelne Ausgaben können hier abgehen     |
| Depot      | Sparplan; Wert wird von Hand eingetragen                     |

Kontostände werden **nur von Hand** eingetragen. Keine Bankanbindung.

## Begriffe

- **Posten**: etwas, das (wiederkehrend oder einmalig) von einem Konto abgeht.
  Hat ein `vonKonto`, optional ein `nachKonto` (dann ist es eine Umbuchung, z. B. Sparrate).
- **Termin**: ein konkretes Vorkommen eines Postens an einem Datum.
  Schlüssel: `<quelle>:<postenId>:<YYYY-MM-DD>`.
- **Abgleich**: Kontostand von Hand eintragen. Speichert je Konto `stand`, `datum`,
  `zeitpunkt` und `offen` (Termine bis `datum`, die noch nicht abgegangen sind).
- **Ausgabe**: bereits getätigte Ausgabe in einem Lebensbereich (Budget).

## Rechenregeln

1. **Gehaltstag**: Tag im Monat (größer als Monatslänge → letzter Tag).
   `nächsterGehaltstag` = erster Gehaltstag *nach* heute,
   `letzterGehaltstag` = letzter Gehaltstag *bis einschließlich* heute.
2. **Ausstehend** auf Konto K = alle Termine, die K berühren und
   - `abgleich.datum < termin.datum < nächsterGehaltstag`, oder
   - deren Schlüssel in `abgleich.offen` steht.
   Termine *am* Gehaltstag werden schon vom neuen Gehalt getragen.
3. **Effektiver Stand** = eingetragener Stand − Ausgaben auf K, die *nach* dem
   Abgleich-Zeitpunkt erfasst wurden.
4. **Restbudget** je Lebensbereich = max(0, Plan − Ausgaben im Budgetzeitraum).
   Budgetzeitraum = `[letzterGehaltstag, nächsterGehaltstag)`.
5. **Wirklich verfügbar (Giro)** = effektiver Stand − ausstehende Abgänge
   + ausstehende Zugänge − Restbudgets.
6. **Jährliche (nicht monatliche) Kosten mit Rücklage**:
   - jeden Monat am Rücklagetag Umbuchung Giro → Geldmarkt über ⌈Betrag / Intervallmonate⌉,
     ab dem Startmonat der Rücklage;
   - am Fälligkeitstag Abgang vom Zahlkonto; ist das Zahlkonto nicht das Rücklagekonto,
     entsteht am selben Tag automatisch ein Ausgleich Geldmarkt → Zahlkonto.
   Ergebnis: Das Giro trägt nur die Monatsrate.
7. **Abgleich**: Termine im Zeitraum `(altes datum, heute]` plus bisher offene werden
   angezeigt. Abgehakt = abgegangen; der Rest wird in `offen` übernommen.
   Erwarteter Stand = effektiver Stand − abgehakte Abgänge + abgehakte Zugänge.
   Differenz zum eingegebenen Stand kann als Ausgabe einem Lebensbereich zugeordnet werden.

Alle Beträge sind ganzzahlige **Cent**.

## Architektur

```
src/
  core/        reine Logik + Ports, kennt keine Module
  ui/          gemeinsame Oberflächen-Bausteine + Styles (nutzt nur core)
  storage/     JSON-Speicher (Tauri-Datei, Browser-Fallback)
  modules/     ein Ordner pro Feature, öffentliche API nur über index.ts
  app/         Shell: Navigation, Laden/Speichern, Zusammenstecken der Module
src-tauri/     Desktop-Hülle (Standard-Gerüst, keine Fachlogik)
```

Importregeln (per Test geprüft):
- `core` importiert nichts aus `ui`, `modules`, `storage`, `app`.
- `ui` importiert nur `core`.
- Ein Modul importiert `core`, `ui` und von anderen Modulen nur deren `index.ts`.
- `app` darf alles.

Jedes Modul liefert ein `FeatureModule`: id, Datenbereich (Zod-Schema + Startwerte),
Navigationseinträge mit Seiten, optional eine `CashflowSource` und ein `AbgleichZiel`.

Modul-Abhängigkeiten (nur über index.ts): `zahlungen → konten`, `budgets → konten, zahlungen`,
`sparen → konten, zahlungen`, `uebersicht → alle`. `konten` hängt von keinem Modul ab;
die Abgleich-Differenz verbucht es über den Port `AbgleichZiel`, den `budgets` bereitstellt.

## Schritte (alle erledigt)

1. Projektgerüst
2. Core: Money, Datum, Wiederholung, Gehaltstag (+ Tests)
3. Core: Cashflow-Engine, Registry, Store, Speicherung (+ Tests)
4. Modul Konten & Abgleich
5. Modul Zahlungen (Fixkosten, Rechnungen, Umbuchungen, Rücklagen)
6. Modul Budgets
7. Modul Sparen & Übersicht
8. App-Shell, Tauri, Architekturtest, Prüfung
