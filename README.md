# Finanz-Cockpit

App für die Frage **„Wie viel Geld gehört mir bis zum nächsten Gehalt wirklich?“**

Kontostand von Hand eintragen, Fixkosten, Rechnungen, Sparraten und Budgets planen. Die App
zieht alles ab, was bis zum nächsten Gehaltseingang noch abgeht, und zeigt, was wirklich frei ist.
Keine Bankanbindung und keine Cloud. Die Daten liegen auf deinen Geräten. Wer will, gleicht sie
**verschlüsselt** über einen eigenen kleinen Server (z. B. einen Raspberry Pi) zwischen Laptop und
iPhone ab. Der Server kann sie nicht lesen.

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
- **Sicherung & Sync**:
  - Sicherung als Datei exportieren und einlesen.
  - Geräte Ende zu Ende verschlüsselt abgleichen.
  - Bei Konflikten entscheidest du, und der andere Stand bleibt als Fallschirm erhalten.

Die genauen Rechenregeln stehen in [docs/PLAN.md](docs/PLAN.md).

## Installieren

**Windows:** Unter GitHub → Actions → „Installer bauen“ den letzten grünen Lauf öffnen und unten bei
Artifacts `finanz-cockpit-windows` herunterladen. Jeder Pull Request baut einen eigenen Installer, damit du
ihn vor dem Merge testen kannst. Darin liegen `.msi` und `-setup.exe`. Der Installer
ist nicht signiert, beim ersten Start warnt Windows deshalb. Klick dann auf „Weitere Informationen“ und
„Trotzdem ausführen“ (siehe [Entscheidung 0001](docs/entscheidungen/0001-installer-aus-github-actions.md)).

**iPhone:**
1. `https://<github-name>.github.io/HMDIO/` in Safari öffnen.
2. Teilen → **Zum Home-Bildschirm**.
3. Die App immer vom Home-Bildschirm aus starten, nur dort hat sie ihren eigenen Speicher (siehe
   [Entscheidung 0004](docs/entscheidungen/0004-handy-als-web-app.md)).

Einmalig im Repo einschalten: Settings → Pages → Source: „GitHub Actions“.

**Sync zwischen Geräten:** Den Pi richtest du nach [docs/pi-plan.md](docs/pi-plan.md) ein. Danach
richtest du in der App unter „Sicherung & Sync“ zuerst das Gerät mit deinen Daten ein, dann die übrigen.

## Entwickeln

Voraussetzungen: Node.js 24, pnpm. Für die Desktop-App zusätzlich Rust (stable) und die
[Tauri-Systemvoraussetzungen](https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm check          # Tests, Typprüfung und Build in einem – vor jedem Commit
pnpm dev            # im Browser (Daten im Browser-Speicher)
pnpm tauri dev      # Desktop-App im Entwicklungsmodus
pnpm sync-server    # Sync-Server lokal (siehe server/README.md)
```

Wie hier gearbeitet wird (Branches, Commits, Entscheidungen, Arbeiten mit Claude), steht in
[docs/ARBEITSWEISE.md](docs/ARBEITSWEISE.md). Die Kurzfassung findest du in
[CONTRIBUTING.md](CONTRIBUTING.md).

## Wo liegen meine Daten?

| Wo | Ort |
|----|-----|
| Desktop-App, Windows | `%APPDATA%\de.finanzcockpit.app\` |
| Desktop-App, macOS | `~/Library/Application Support/de.finanzcockpit.app/` |
| Desktop-App, Linux | `~/.local/share/de.finanzcockpit.app/` |
| Web-App (iPhone, Browser) | im Speicher der App auf dem Gerät |
| Sync-Server | nur verschlüsselt, in `server/daten/` auf dem Pi |

In der Desktop-App liegen dort `finanzen.json` und `backups/`. Vor dem ersten Speichern je Programmstart
entsteht eine Sicherung, die letzten 10 bleiben. Exporte landen in `exporte/`. Der genaue Pfad steht
unten links in der App. Ist die Datei beschädigt, zeigt die App einen Fehler und überschreibt nichts.

## Aufbau

```
src/core/       Rechenlogik (Cent-Beträge, Termine, Gehaltstag, „verfügbar“), Store, Speicher-Format, Tresor (Verschlüsselung)
src/ui/         gemeinsame Bausteine + Styles
src/storage/    JSON-Datei (Tauri) bzw. Browser-Speicher, Sync mit dem Server
src/modules/    konten · zahlungen · budgets · sparen · uebersicht
src/app/        Shell, Liste der aktiven Module, Seite „Sicherung & Sync“
src-tauri/      Desktop-Hülle, nur Dateizugriff im App-Datenordner erlaubt
server/         Sync-Server für den Pi (ohne Abhängigkeiten, als Container)
docs/           Fachregeln (PLAN), Arbeitsweise, Entscheidungen, Pi-Plan
.github/        Prüfen bei jedem Push, Installer, Web-App
```

### Neues Modul hinzufügen

1. Ordner `src/modules/<name>/` mit `index.ts`, das ein `FeatureModule` exportiert:
   eigener Datenbereich (Zod-Schema + Startwerte), Seiten für die Navigation und optional eine
   `CashflowSource`, deren Termine/Reservierungen automatisch in „wirklich verfügbar“ einfließen.
2. In `src/app/modules.ts` eintragen.

Der Test `src/architektur.test.ts` prüft, dass Module nur über `index.ts` voneinander importieren.
