# 0001 – Installer entstehen in GitHub Actions, nicht auf einem PC

- Datum: 2026-11-06
- Status: gilt

## Ausgangslage

Die Desktop-App ist eine Tauri-App. Um einen Windows-Installer zu bauen, braucht man Rust, die
Visual-Studio-Build-Tools (C++) und die Tauri-Werkzeuge, zusammen mehrere GB. Lisas Laptop läuft
mit Windows. Das Repo ist öffentlich.

## Optionen

1. **GitHub Actions (gewählt).** Ein Workflow baut den Installer auf einem frischen Windows-Rechner
   von GitHub.
   - Für öffentliche Repos kostenlos.
   - Jedes Mal dieselbe saubere Umgebung, das Ergebnis hängt also nicht vom PC ab, auf dem gebaut
     wurde.
   - Auf den eigenen Rechnern muss nichts installiert werden.
   - Folge: Ein Bau dauert einige Minuten, und man startet ihn im Browser.
2. **Lokal bauen.** Das Ergebnis ist sofort da, aber der Werkzeugstapel liegt dann auf dem PC.
   Wer den Installer gebaut hat und womit, ist später nicht mehr nachvollziehbar.
3. **Signierter Installer.** Windows warnt dann nicht mehr. Ein Code-Signing-Zertifikat kostet
   aber jährlich. Das lohnt sich erst, wenn andere die App nutzen.

## Entscheidung

Installer entstehen nur über den Workflow „Installer bauen“. Er läuft bei jedem Pull Request, damit
du vor dem Merge testen kannst, außerdem von Hand und bei einem Tag `v*`. Gebaut wird vorerst nur für
Windows, weil nur Windows gebraucht wird.

*Nachtrag 2026-11-06:* Den Knopf „Run workflow“ zeigt GitHub erst, wenn die Workflow-Datei auf
`main` liegt. Ein Branch allein lässt sich so nicht bauen. Deshalb kam der Auslöser `pull_request`
dazu.

## Folgen

- Der Installer ist **nicht signiert**. Windows SmartScreen zeigt deshalb beim ersten Start
  „Der Computer wurde durch Windows geschützt“. Dann auf „Weitere Informationen“ und
  „Trotzdem ausführen“ klicken.
- Vor dem Bau laufen die Tests. Ein roter Stand ergibt keinen Installer.
- macOS und Linux brauchen nur einen weiteren Job mit `runs-on: macos-latest` bzw. `ubuntu-latest`.
- Die Prüfung „Prüfen“ (`pruefen.yml`) läuft bei jedem Push und ist die Pflichtprüfung für `main`.
