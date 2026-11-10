# Mitmachen

Kurzfassung; das Warum steht in [docs/ARBEITSWEISE.md](docs/ARBEITSWEISE.md).

## Vorbereitung

- Node.js 24 und pnpm (`corepack enable` oder `npm install -g pnpm`)
- nur für den Desktop-Bau: Rust (stable) und die [Tauri-Voraussetzungen](https://v2.tauri.app/start/prerequisites/)
- `pnpm install`

## Ablauf

1. Branch von `main` anlegen: `git switch -c <thema>`
2. Ändern, dann `pnpm check`. Das prüft Typen, führt die Tests aus und baut die Web-App.
3. Committen, mit einem Gedanken pro Commit:
   ```
   feat: Sparziele nach Datum sortieren

   Bisher standen sie in Anlegereihenfolge; mit vielen Zielen sucht man.
   ```
4. Pushen und einen Pull Request öffnen. Die Prüfung „Prüfen“ muss grün sein.
5. Mit **Squash and merge** zusammenführen.

## Regeln, die Tests prüfen

- Importregeln zwischen `core`, `ui`, `modules`, `storage`, `app` (siehe `src/architektur.test.ts`)
- Rechenregeln aus [docs/PLAN.md](docs/PLAN.md) (Beträge immer in Cent)

## Regeln, die niemand prüft – außer du

- Neue Begriffe in [docs/PLAN.md](docs/PLAN.md) eintragen.
- Entscheidungen mit mehreren Optionen in [docs/entscheidungen/](docs/entscheidungen/README.md) festhalten.
- Keine Geheimnisse und keine echten Finanzdaten in Code, Tests oder Screenshots.
