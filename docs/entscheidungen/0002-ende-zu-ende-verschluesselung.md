# 0002 – Daten werden im Gerät verschlüsselt, bevor sie es verlassen

- Datum: 2026-11-06
- Status: gilt

## Ausgangslage

Die Daten sollen zwischen Laptop und iPhone wandern, also über einen Server. Wer diesen Server
betreibt, soll die Finanzdaten trotzdem nicht lesen können. Das kann ein eigener Pi sein, das
Homelab eines Freundes oder eine Cloud.

**Grundregel:** Wer Admin auf einem Rechner ist, kommt an alles, was dort entschlüsselt wird. Das
gilt für den Speicher, für Schlüssel in Umgebungsvariablen und für den Code selbst.

## Bedrohungsmodell

| Schutz gegen … | Schutz? | Wie |
|---|---|---|
| Betreiber bzw. Admin des Servers | ja | Der Server bekommt nur verschlüsselte Daten, nie Passwort oder Schlüssel |
| Diebstahl von SD-Karte, Festplatte oder Sicherung des Servers | ja | dasselbe |
| Mitlesen im Netz | ja | Verschlüsselung, zusätzlich HTTPS bzw. Tailscale |
| Jemand mit deinem entsperrten Laptop oder Handy | nein (bewusst) | Die Daten liegen dort lesbar, wie vorher auch |
| Schadsoftware auf deinem Gerät | nein | Dagegen hilft keine App-Verschlüsselung |
| Was der Server trotzdem sieht | – | **Dass** und **wann** synchronisiert wird und wie groß der Tresor ist |

## Optionen

1. **Verschlüsselung im Gerät, also Ende zu Ende (gewählt).** Der Server bewahrt nur einen Tresor
   auf, den er nicht öffnen kann.
2. **Verschlüsselung auf dem Server**, zum Beispiel eine verschlüsselte Datenbank im Container.
   Das schützt nur gegen Festplattendiebe. Der Admin sieht den Schlüssel im Arbeitsspeicher und
   kann den Code austauschen.
3. **Nur Zugangsschutz (Passwort für den Server).** Admin und Sicherungen sehen dann alles im
   Klartext.

## Entscheidung

Verschlüsselt wird im Gerät mit Web Crypto, ohne Fremdbibliothek (`src/core/tresor.ts`):

- **Schlüssel:** PBKDF2-SHA-256 aus Passwort und 16 Byte Zufallssalz, 600.000 Runden. Das ist die
  OWASP-Empfehlung für PBKDF2-SHA-256.
- **Verschlüsselung:** AES-GCM-256 mit frischem 12-Byte-IV bei jedem Speichern.
- **Kopf geschützt:** Format, Version und Schlüssel-Parameter sind als „zusätzliche Daten“
  mitgeschützt. Ein manipulierter Kopf macht den Tresor unlesbar. Mehr als 10 Mio. Runden lehnt die
  App ab, damit ein manipulierter Tresor das Gerät nicht lahmlegen kann.
- **Schlüssel bleibt im Gerät:** Er ist nicht exportierbar und wird pro Gerät im Browser-Speicher
  (IndexedDB) gemerkt. Das Passwort tippst du deshalb nur einmal pro Gerät.
- **Prüfwert:** Ein kleiner Tresor mit bekanntem Inhalt prüft das Passwort beim Entsperren, auch
  offline. Ein Tippfehler kann so nie dazu führen, dass mit falschem Schlüssel hochgeladen wird.
- **Woher der Code kommt:** Der App-Code kommt **nie** vom Sync-Server, sondern aus dem Installer
  oder von GitHub Pages. Käme er vom selben Server, könnte dessen Betreiber ihn so ändern, dass er
  das Passwort mitliest.

## Folgen

- **Passwort vergessen heißt: Der Tresor auf dem Server ist verloren.** Die Daten auf deinen Geräten
  bleiben erhalten, damit lässt sich ein neuer Tresor anlegen. Das Passwort gehört in den
  Passwortmanager.
- Die Oberfläche verlangt mindestens 12 Zeichen. Am besten nimmst du einen Satz.
- Ein Passwortwechsel ist noch nicht eingebaut. Bis dahin: Sync ausschalten, den Tresor auf dem
  Server zur Seite legen, neu einrichten.
- Dass der Server nichts lesen kann, belegen die Tests in `src/core/tresor.test.ts`. Geprüft werden
  dort falsches Passwort, veränderte Daten und veränderter Kopf.
