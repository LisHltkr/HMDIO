# 0003 – Sync über einen eigenen Pi, erreichbar nur über Tailscale

- Datum: 2026-11-06
- Status: gilt

## Ausgangslage

Laptop (Windows, Desktop-App) und iPhone (Web-App) sollen dieselben Daten haben. Ein Raspberry Pi
ist vorhanden. Gewünscht ist: sicher, bequem, günstig, anfängerfreundlich. Die Web-App braucht eine
Gegenstelle mit HTTPS. Heimanschlüsse liegen oft hinter CGNAT, und Portfreigaben machen einen Dienst
im ganzen Internet angreifbar.

## Optionen

1. **Eigener Pi plus Tailscale (gewählt).**
   - Kosten: keine Hardware, der Pi ist vorhanden. Strom etwa 3 W, also rund 8 € im Jahr.
   - Tailscale ist für private Nutzung kostenlos.
   - Der Dienst ist nicht öffentlich. `tailscale serve` liefert ein gültiges HTTPS-Zertifikat für
     `<pi>.<tailnet>.ts.net`.
   - Folge: Jedes Gerät braucht die Tailscale-App.
2. **Server eines Freundes oder in dessen Homelab.** Man betreibt selbst nichts, ist aber von jemandem
   abhängig. Dank 0002 sieht der Betreiber trotzdem nichts.
3. **Kostenloses Cloud-Konto.** Unabhängig von Freunden, dafür ein weiteres Konto bei einem Anbieter.
   Dank 0002 ebenfalls unlesbar.
4. **Öffentlich per Portfreigabe.** Angriffsfläche fürs ganze Internet. Abgelehnt.

## Entscheidung

- **Ein Tresor statt einzelner Posten.** Der Server bewahrt einen einzigen Tresor auf, also den
  ganzen Datenstand, verschlüsselt. Das ist bewusst einfach: kein Zusammenführen einzelner Posten.
- **Konflikte per ETag.** Jedes Gerät merkt sich den ETag des Stands, den es zuletzt kannte, und
  sendet nur mit `If-Match`. Hat inzwischen ein anderes Gerät gespeichert, antwortet der Server mit
  412.
- **Konflikte entscheidest du.** Die App mischt nicht automatisch. Sie fragt: „Stand vom Server
  übernehmen“ oder „meinen Stand behalten“. Die überschriebene Seite legt sie vorher zur Seite.
- **Frühere Stände:** Die letzten 30 bleiben auf dem Pi unter `daten/versionen/`.
- **Zugangsschlüssel:** mindestens 32 Zeichen. Er schützt gegen Überschreiben, nicht gegen Lesen.
  Gegen Lesen schützt 0002.
- **CORS:** Nur die Web-App (GitHub Pages) und die Desktop-App dürfen per Browser zugreifen.
- **Container:** ohne Root, schreibgeschützt, ohne Sonderrechte. Er lauscht nur auf `127.0.0.1`,
  nach außen geht es ausschließlich über `tailscale serve`.

## Folgen

- **Konflikte entstehen nur**, wenn zwei Geräte etwas ändern, bevor sie sich abgeglichen haben, zum
  Beispiel ohne Netz.
- **Der Pi muss nicht dauernd laufen.** Die App arbeitet ohne ihn weiter und gleicht ab, sobald er
  erreichbar ist. Fällt der Pi aus, gehen keine Daten verloren, denn sie liegen auf jedem Gerät.
- **Anderer Server später:** Gleiche Datei, irgendein HTTPS-Host. Die Desktop-App erlaubt per CSP
  nur `https://*.ts.net`. Für einen anderen Host muss `connect-src` in `src-tauri/tauri.conf.json`
  angepasst werden.
- **Betrieb:** Einrichtung, Wartung und Fehlerbilder stehen in [docs/pi-plan.md](../pi-plan.md).
