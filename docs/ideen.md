# Ideen und Wünsche

Hier landet jede Idee, bevor etwas gebaut wird. Jede Idee hat vier Teile: der Wunsch in Lisas
Worten, was die App heute kann, ein Vorschlag mit offenen Fragen und der Stand.
Gebaut wird erst nach einer Entscheidung, jede Idee in einem eigenen Branch. Später kann aus
jeder Idee gern ein GitHub-Issue werden, dann verweist der Commit darauf („Closes #12“).

| Nr. | Idee | Stand |
|-----|------|-------|
| 1 | Datumsfelder immer TT.MM.JJJJ | erledigt, Branch `kleine-anpassungen` |
| 2 | Gehaltstag: von 1 „runter“ auf 31 (Monatsende) | erledigt, Branch `kleine-anpassungen` |
| 3 | Rückgängig für die letzten Schritte | kommt nach dem Merge von `sync-handy-installer` |
| 4 | Verlauf: was ist abgegangen, nach Gehaltsmonat | nach 3 |
| 5 | Lücken beim Bearbeiten und Löschen schließen | zusammen mit 4 |
| 6 | Optionen, die man einstellen kann | offen, Frage an Lisa |
| 7 | Zusätzliches Einkommen (Vinted, eBay, Aufträge) | offen, Fragen an Lisa |
| 8 | Sparen & Rücklagen: Geld einzahlen oder entnehmen | offen, Fragen an Lisa; zusammen mit 4 planen |
| 9 | Kontoauszüge als CSV einlesen und auswerten | offen, Fragen an Lisa |
| 10 | Zahlenfelder absichern: nur Ziffern annehmen | offen, Frage an Lisa |

## 1 – Datumsfelder immer TT.MM.JJJJ

- **Wunsch:** „Datum: deutsche Notation grundsätzlich“, also TT.MM.JJJJ (am 07.11.2026 bestätigt).
- **Vorher:**
  - Angezeigte Daten waren schon deutsch.
  - Die vier Eingabefelder (Fälligkeit, Ende, Erste Rate, Datum einer Ausgabe) nahmen das Format
    des Geräts, auf einem englischen System also MM/TT/JJJJ.
- **Jetzt:**
  - Die Felder zeigen immer TT.MM.JJJJ. Kurzformen wie „5.1.27“ werden zu 05.01.2027, am Handy gehen
    auch reine Ziffern („151126“).
  - Der Kalender-Knopf öffnet die Datumsauswahl des Geräts.
  - Unmögliche Daten wie der 31.02. werden rot markiert.

## 2 – Gehaltstag läuft rund

- **Wunsch:** „Wenn Datum bei 1: Pfeil runter = nächsthöchster Tag“
- **Entscheidung (07.11.2026):** Von 1 geht „runter“ auf 31, also Monatsende. Von 31 geht „hoch“
  auf 1. Ab dem 29. zeigt der Hinweis das echte Datum in diesem Monat, zum Beispiel „30.11.“.

## 3 – Rückgängig

- **Wunsch:** „Alle Beträge, die ich buche, wieder rückgängig machen oder rausbuchen können,
  falls man sich z. B. bei ‚Miete bezahlt‘ vertippt.“
- **Heute:** Ein Kontostand-Eintrag überschreibt den vorherigen. Ein versehentlich als
  „abgegangen“ abgehakter Posten lässt sich nicht wieder öffnen.
- **Vorschlag:** Ein Knopf „Rückgängig“ und Strg+Z für die letzten Schritte. Die App merkt sich dafür
  die früheren Stände.

## 4 – Verlauf

- **Wunsch:** „Eine Übersicht, was so abgegangen ist, sinnvoller und ordentlicher organisiert.“
- **Heute:** Es gibt keinen Verlauf, nur die Ausgaben im Budget.
- **Vorschlag (Entwurf vom 06.11.2026):** Eine Seite „Verlauf“, nach Gehaltsmonat gruppiert und
  nach Art und Konto filterbar.
  - Jeder Kontostand-Eintrag zeigt die abgehakten Posten.
  - Ein einzelner Posten lässt sich **wieder öffnen**.
  - Den neuesten Eintrag je Konto kannst du **zurücknehmen**.
  - Ausgaben lassen sich **bearbeiten** und **löschen**.
- **Folge:** Der Verlauf beginnt erst mit dem Einbau, frühere Kontostände hat die App nicht
  gespeichert.

## 5 – Lücken beim Bearbeiten und Löschen

- **Wunsch:** „Typische CRUD-Funktionalität, anpassbar“
- **Heute:**
  - Posten und Sparziele: anlegen, bearbeiten, löschen.
  - Ausgaben: nur löschen.
  - Konten: nur anlegen und umbenennen.
- **Vorschlag:** Ausgaben bearbeiten. Konten ausblenden oder löschen, mit Schutz, solange noch
  Posten daran hängen.

## 6 – Optionen

- **Wunsch:** „Ein paar Optionen, die man setzen kann“
- **Offene Frage an Lisa:** Welche? Ideen dazu:
  - Rückfrage vor dem Löschen an oder aus
  - Verlauf nach Gehalts- oder Kalendermonat
  - wie viele Schritte Rückgängig
  - ein fester Lebensbereich für Differenzen beim Kontostand

## 7 – Zusätzliches Einkommen

- **Wunsch:** „Zusätzliches Einkommen (Vinted, eBay, einmalig halt, ggf. Auftrag zeichnen)“
- **Heute:**
  - Außer dem Gehalt kennt die App keine Einnahmen.
  - Posten gehen immer von einem Konto ab.
  - Zugänge entstehen nur durch Umbuchungen.
- **Vorschlag:** Eine neue Posten-Art „Einnahme“ auf ein Konto, einmalig oder wiederkehrend, mit
  Kategorie (Verkauf, Auftrag …).
- **Offene Fragen an Lisa:**
  1. Soll eine erwartete Einnahme schon in „wirklich verfügbar“ zählen, bevor das Geld da ist?
     - Vorschlag: nein, vorsichtig rechnen.
     - Daneben „erwartet“ getrennt anzeigen, zum Beispiel einen Verkauf, der noch nicht bezahlt ist.
  2. Unsichere Beträge, etwa ein Auftrag, der noch nicht fest zugesagt ist: Gibt es die als „vielleicht“?
  3. Eine Monatsübersicht der Nebeneinnahmen nach Kategorie?

## 8 – Sparen & Rücklagen: Geld einzahlen oder entnehmen

- **Wunsch:** „Bei Sparen und Rücklagen ggf. auch einen Button zum Hinzufügen oder Entnehmen von Geld
  von dem Konto“
- **Heute:**
  - Die Seite zeigt Sparziele (anlegen, bearbeiten, löschen) und ob die Rücklagen reichen.
  - Geld kommt nur über geplante Umbuchungen (Sparrate) oder einen neu eingetragenen Kontostand
    (Seite „Konten“) aufs Sparkonto.
- **Vorschlag:** Auf jeder Konto-Karte die Knöpfe „Einzahlen“ und „Entnehmen“. Ein kleiner Dialog fragt
  Betrag, Gegenkonto (z. B. Girokonto oder „von außen“) und Datum (vorbelegt: heute) ab.
- **Offene Fragen an Lisa:**
  1. Ist das Geld meistens eine Umbuchung zwischen deinen eigenen Konten?
     - Dann ändern sich beide Stände, und „wirklich verfügbar“ auf dem Giro sinkt beim Einzahlen.
     - Oder kommt es auch von außen (Geschenk, Verkauf; dann gehört es zu Idee 7)?
  2. Soll eine Entnahme einem Sparziel oder einer Rücklage zugeordnet werden, z. B. „Puffer“ oder
     „Kfz-Versicherung“?
  3. Jede Ein- und Auszahlung landet im Verlauf (Idee 4) und lässt sich dort zurücknehmen. Deshalb
     am besten zusammen mit dem Verlauf bauen.

## 9 – Kontoauszüge als CSV einlesen und auswerten

- **Wunsch:** „Automatischer Input/Analyse von CSV-Kontoauszügen“ (10.11.2026)
- **Heute:**
  - Kontostände und Ausgaben werden nur von Hand eingetragen.
  - Beim Kontoabgleich lässt sich die Differenz gesammelt einem Lebensbereich zuordnen.
- **Vorschlag:** Eine CSV-Datei aus dem Online-Banking (Export, keine Bankanbindung) wird **nur auf
  dem Gerät** gelesen.
  - Vorschau der Buchungen, vor dem Übernehmen.
  - Abbuchungen werden geplanten Posten zugeordnet, zum Beispiel „Miete 780 €“, und dann als
    „abgegangen“ abgehakt.
  - Übrige Ausgaben werden Lebensbereichen vorgeschlagen, mit Regeln wie „REWE → Essen“.
  - Bereits eingelesene Buchungen werden erkannt, damit nichts doppelt zählt.
  - Daraus eine Auswertung: Ausgaben je Lebensbereich und Monat, wiederkehrende Abbuchungen, die
    noch nicht als Fixkosten eingetragen sind.
- **Offene Fragen an Lisa:**
  1. Welche Bank oder Banken? Jede Bank hat ihr eigenes CSV-Format. Eine Beispieldatei mit
     geschwärzten Namen und Beträgen hilft beim Bauen.
  2. Soll der eingelesene Endsaldo den Kontostand ersetzen? Das wäre ein Kontoabgleich ohne Abtippen.
  3. Nur am Desktop, oder auch am iPhone über die Dateien-App?
- **Hinweis:** Passt gut zum Verlauf (Idee 4): Eingelesene Buchungen landen dort.

## 10 – Zahlenfelder absichern

- **Wunsch:** „Zahlenfelder absichern – nur Zahlen, keine Sonderzeichen (verhindern?)“ (10.11.2026)
- **Heute:**
  - Betragsfelder nehmen jeden Text an. Ist er kein gültiger Betrag, wird das Feld rot und der Wert
    nicht übernommen.
  - Am Handy öffnet sich schon die Zahlentastatur. Am Desktop kann man trotzdem Buchstaben tippen.
  - Gehaltstag und Tag der Rate sind Zahlenfelder des Browsers. Was sie zulassen, ist je nach
    Gerät unterschiedlich.
- **Vorschlag:** Beim Tippen und Einfügen werden nur Ziffern, ein Komma und Tausenderpunkte
  angenommen. Alles andere erscheint gar nicht erst.
  - Ein eingefügtes „1.234,56 €“ wird zu „1.234,56“.
  - Das gilt für alle Betrags- und Tagesfelder, an einer Stelle gebaut (`src/ui`).
- **Offene Frage an Lisa:** Ein Minus nur dort, wo es Sinn ergibt (Kontostand im Dispo), sonst
  gesperrt? Vorschlag: ja.
