# Finanz-Cockpit

Desktop-App für die Frage **„Wie viel Geld gehört mir bis zum nächsten Gehalt wirklich?“**

Kontostand von Hand eintragen, Fixkosten, Rechnungen, Sparraten und Budgets planen. Die App
zieht alles ab, was bis zum nächsten Gehaltseingang noch abgeht, und zeigt, was wirklich frei ist.
Keine Bankanbindung, kein Server, keine Cloud: alle Daten liegen in einer JSON-Datei auf deinem Rechner.

## Funktionen

- **Übersicht**: „Wirklich verfügbar“ auf dem Girokonto mit Herleitung, Betrag pro Tag, ausstehende Posten,
  Budgets, alle Konten mit Rücklagen-Soll.
- **Konten**: Giro, Sparkonto, Geldmarkt, Depot (beliebig erweiterbar), Gehalt mit Gehaltstag.
  **Kontostand aktualisieren** fragt ab, was seit dem letzten Stand abgegangen ist; die Differenz kann
  einem Budget zugeordnet werden.
- **Abbuchungen & Fixkosten**: wiederkehrende Kosten, einmalige Rechnungen, Umbuchungen (Sparrate,
  ETF-Sparplan). Jährliche/vierteljährliche Kosten bekommen auf Wunsch eine **monatliche Rücklage**
  (z. B. Giro → Geldmarkt); am Fälligkeitstag wird der Ausgleich zurück eingeplant.
- **Budgets**: Betrag je Lebensbereich pro Gehaltsmonat, „noch nicht verteilt“, Ausgaben erfassen.
- **Sparen & Rücklagen**: Sparziele mit Prognose, Soll/Ist der Rücklagen.

Die genauen Rechenregeln stehen in [docs/PLAN.md](docs/PLAN.md).

## Starten

Voraussetzungen: Node.js 20+, pnpm, Rust (stable) und die
[Tauri-Systemvoraussetzungen](https://v2.tauri.app/start/prerequisites/) deines Betriebssystems.

```bash
pnpm install
pnpm tauri dev      # Desktop-App im Entwicklungsmodus
pnpm tauri build    # Installer bauen (liegt danach unter src-tauri/target/release/bundle/)
pnpm test           # Tests
pnpm typecheck
pnpm dev            # nur im Browser (Daten im localStorage, zum schnellen Entwickeln)
```

## Wo liegen meine Daten?

| System  | Ordner                                                     |
|---------|------------------------------------------------------------|
| Windows | `%APPDATA%\de.finanzcockpit.app\`                          |
| macOS   | `~/Library/Application Support/de.finanzcockpit.app/`      |
| Linux   | `~/.local/share/de.finanzcockpit.app/`                     |

Darin `finanzen.json` und `backups/` (vor dem ersten Speichern je Programmstart eine Sicherung,
die letzten 10 bleiben). Der genaue Pfad steht unten links in der App. Ist die Datei beschädigt,
zeigt die App einen Fehler und überschreibt nichts.

## Aufbau

```
src/core/       Rechenlogik (Cent-Beträge, Termine, Gehaltstag, „verfügbar“), Store, Speicher-Format
src/ui/         gemeinsame Bausteine + Styles
src/storage/    JSON-Datei (Tauri) bzw. localStorage (Browser)
src/modules/    konten · zahlungen · budgets · sparen · uebersicht
src/app/        Shell + Liste der aktiven Module
src-tauri/      Desktop-Hülle, nur Dateizugriff im App-Datenordner erlaubt
```

### Neues Modul hinzufügen

1. Ordner `src/modules/<name>/` mit `index.ts`, das ein `FeatureModule` exportiert:
   eigener Datenbereich (Zod-Schema + Startwerte), Seiten für die Navigation und optional eine
   `CashflowSource`, deren Termine/Reservierungen automatisch in „wirklich verfügbar“ einfließen.
2. In `src/app/modules.ts` eintragen.

Der Test `src/architektur.test.ts` prüft, dass Module nur über `index.ts` voneinander importieren.
