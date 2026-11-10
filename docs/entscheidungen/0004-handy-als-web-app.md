# 0004 – Aufs iPhone als Web-App vom Home-Bildschirm, nicht als native App

- Datum: 2026-11-06
- Status: gilt

## Ausgangslage

Die App soll auch auf einem iPhone 12 laufen. Es gibt keine Apple-Entwicklerlizenz und keinen Mac.

## Optionen

1. **Web-App über GitHub Pages (gewählt).** In Safari öffnen, dann Teilen → „Zum Home-Bildschirm“.
   - Kostenlos.
   - Kein Mac nötig.
   - Gleicher Code wie die Desktop-App.
   - Läuft nach dem zweiten Öffnen auch offline.
2. **Native iPhone-App (Tauri für iOS).** Braucht einen Mac mit Xcode. Ohne das
   Apple-Entwicklerprogramm (99 € im Jahr) läuft eine selbst installierte App nach 7 Tagen ab.
3. **HTML-Datei in der Dateien-App.** iOS zeigt sie nur als Vorschau, die App läuft dort nicht
   richtig. Die JSON-Datei müsste man jedes Mal von Hand auswählen und wieder sichern.

## Entscheidung

Das iPhone bekommt die Web-App. Der Workflow „Web-App veröffentlichen“ baut sie bei jeder Änderung
an `main`.
- Ein Service Worker hält eine Offline-Kopie nach dem Prinzip „erst Netz, dann Kopie“.
- Unter 800 px Breite wird die Navigation zur wischbaren Leiste oben.
- Die App bittet den Browser um dauerhaften Speicher (`navigator.storage.persist()`).

## Folgen

- **Wo die Daten liegen:** Im Speicher der Home-Bildschirm-App, nicht im Netz. Safari löscht
  Website-Speicher nach sieben Tagen ohne Besuch. Eine Home-Bildschirm-App hat aber eigenen Speicher,
  für den diese Regel nicht gilt.
- **Löschst du das Icon, sind die Daten auf dem iPhone weg.** Dagegen helfen Sicherung (Export) und
  Sync (siehe 0002 und 0003).
- **Der Code ist öffentlich, die Daten nicht.** Der App-Code liegt auf GitHub Pages, das Repo ist
  ohnehin öffentlich.
- Für den Sync braucht die Web-App eine Gegenstelle mit HTTPS. Ohne HTTPS blockiert Safari die
  Verbindung.
- Nach einem Update zeigt die App die neue Version beim nächsten Öffnen mit Netz.
