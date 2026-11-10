# Arbeitsweise

So wird an diesem Repo gearbeitet, von Menschen und von Claude. Die Regeln sind kurz, das
**Warum** steht jeweils dabei. Eine Regel mit Begründung lässt sich auf neue Fälle übertragen,
ein bloßes Verbot nicht.

## 1. Erst der Auftrag, dann der Code

- Ein Satz: Was soll danach anders sein?
- Ein zweiter Satz: Woran erkenne ich „fertig“? Zum Beispiel: Tests grün, am iPhone ausprobiert,
  README ergänzt.

*Warum:* Ohne klares Ziel baut man das Falsche gründlich.

## 2. Entscheidungen festhalten

- Gibt es mehrere Wege, stehen sie mit ihren Folgen nebeneinander, die Empfehlung zuerst.
- Die Wahl landet als kurze Notiz in [`docs/entscheidungen/`](entscheidungen/README.md):
  Datum, Ausgangslage, Optionen, Entscheidung, Folgen.

*Warum:* In drei Monaten weiß niemand mehr, warum es PBKDF2 wurde und nicht etwas anderes. Die
Notiz verhindert, dass man dieselbe Diskussion zweimal führt oder eine bewusste Entscheidung
versehentlich umwirft.

## 3. Ein Begriff, eine Bedeutung

| Begriff | Bedeutung |
|---------|-----------|
| Abgleich | Kontostand von Hand eintragen und mit den geplanten Posten vergleichen |
| Sync | Daten zwischen deinen Geräten austauschen |
| Tresor | die verschlüsselte Datei, die der Sync-Server aufbewahrt |
| Sicherung | Export deiner Daten als Datei |

Neue Begriffe kommen in [`docs/PLAN.md`](PLAN.md).

*Warum:* Doppeldeutige Wörter erzeugen doppeldeutigen Code. „Abgleich“ war schon vergeben, deshalb
heißt die Geräte-Synchronisation „Sync“.

## 4. Kleine Schritte

- Ein Branch pro Vorhaben, ein Commit pro Gedanke.
- Die erste Zeile der Commit-Nachricht sagt **was** (höchstens 72 Zeichen, mit Präfix `feat`, `fix`,
  `docs`, `ci`, `refactor`, `test`, `chore`). Darunter steht **warum**.
- Jeder Commit ist für sich grün: `pnpm check` (Typprüfung, Tests, Build).

*Warum:* Kleine Commits lassen sich lesen, prüfen und einzeln zurücknehmen. Ein roter Commit
in der Mitte macht jede spätere Fehlersuche teurer.

## 5. `main` ist immer lauffähig

- Auf `main` kommt nichts direkt, nur per Pull Request.
- Zusammengeführt wird, wenn die Prüfung „Prüfen“ grün ist, mit **Squash and merge**.
- Einrichten in GitHub unter Settings → Branches → Add branch ruleset für `main`:
  „Require a pull request before merging“ und „Require status checks to pass“ mit `pruefen`.

*Warum:* Aus `main` entstehen Installer und Web-App. Was dort liegt, muss funktionieren.

## 6. Prüfen statt annehmen

- **Logik** wird mit Tests geprüft (`src/**/*.test.ts`, `server/*.test.ts`).
- **Oberfläche** wird mit einer Bedienprobe mit Testwerten geprüft, nie mit echten Daten.
- **Das echte Erlebnis:** Installer installieren, App am iPhone öffnen, eine Änderung auf dem
  anderen Gerät wiederfinden.
- „Gebaut“ heißt nicht „funktioniert“. Eine Probe, die nur einen Stellvertreter misst
  (zum Beispiel „die Datei existiert“), ist keine Probe.

*Warum:* Die teuersten Fehler sind die, die man für erledigt hält.

## 7. Sicherheit zuerst

- **Erst das Bedrohungsmodell, dann der Krypto-Code:** Vor wem schützen wir, und was darf diese
  Person sehen? Siehe [Entscheidung 0002](entscheidungen/0002-ende-zu-ende-verschluesselung.md).
- **Geringste Rechte:**
  - Die Desktop-Hülle darf nur in ihrem eigenen Ordner schreiben.
  - Die CSP erlaubt nur die nötigen Verbindungen.
  - Der Container läuft ohne Root-Rechte und schreibgeschützt.
- **Keine Geheimnisse ins Repo:** Token und Passwörter gehören in den Passwortmanager.
  `.gitignore` schützt `server/token.txt` und `server/daten/`.
- **Fallschirm:** Vor riskanten Schritten kommt eine Sicherung. Die App sichert vor dem ersten
  Speichern, und vor einer Konfliktlösung legt sie die Daten dieses Geräts zur Seite.

*Warum:* Es sind Finanzdaten.

## 8. Doku gehört zur Arbeit

- Ändert sich die Bedienung, wird die README im selben Branch nachgezogen.
- Betriebsanleitungen wie [`docs/pi-plan.md`](pi-plan.md) haben nach jedem Schritt einen
  **Prüfschritt**.

*Warum:* Doku, die hinterherhinkt, ist schlimmer als keine. Man glaubt ihr.

## 9. Mit Claude (oder Claudius) arbeiten

- **Gib Auftrag und Grenzen vor**, zum Beispiel: „nur in `src/modules/sparen`“, „keine neuen
  Abhängigkeiten ohne Rückfrage“.
- **Verlange Optionen mit Folgen** und entscheide selbst.
- **Belege statt Beteuerungen:** Claude lässt `pnpm check` laufen und zeigt dir das Ergebnis.
- **Lies die Diffs Commit für Commit.** Merge nichts, was du nicht verstanden hast. Nachfragen ist
  ausdrücklich erwünscht.
- **Geheimnisse nie in den Chat:** Token und Passwörter tippst du selbst ein.

## Ablauf in Kurzform

1. Auftrag und Fertig-Kriterium festlegen.
2. Optionen vergleichen und die Entscheidung notieren.
3. Branch anlegen.
4. In kleinen, grünen Commits arbeiten.
5. Pushen, bis die CI grün ist.
6. Pull Request öffnen, Diffs lesen, mit Squash zusammenführen.
7. Echte Probe am Gerät.
8. Doku aktuell halten.
