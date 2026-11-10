# Plan: Sync-Server auf dem eigenen Raspberry Pi

Dieser Plan richtet den Sync-Server auf deinem Pi ein, damit Laptop und iPhone dieselben Daten haben.
Er ist so geschrieben, dass du ihn allein oder zusammen mit Claude („Claudius“) abarbeiten kannst.
Warum es so gebaut ist, steht in den Entscheidungen
[0002](entscheidungen/0002-ende-zu-ende-verschluesselung.md) und
[0003](entscheidungen/0003-sync-ueber-eigenen-pi.md).

## Für Claudius: So arbeitest du diesen Plan ab

1. **Ein Schritt nach dem anderen.** Nach jedem Schritt führt Lisa den Prüfbefehl aus. Du schaust dir
   das Ergebnis an und gehst erst danach weiter.
2. **Erst erklären, dann tippen lassen.** Sag vor jedem Befehl kurz, was er tut und warum. Lösche nichts
   ohne Rückfrage.
3. **Geheimnisse gehören nie in den Chat.** Zugangsschlüssel, Sync-Passwort und Tailscale-Login tippt
   oder kopiert Lisa selbst. Du fragst nur: „Hat es geklappt?“
4. **Bei Fehlern erst lesen, dann handeln.** Schau dir Status und Protokolle an, stelle eine Vermutung
   auf und prüfe sie gezielt. Kein wildes Ausprobieren.
5. **Nie öffentlich machen.** Keine Portfreigabe am Router, kein `tailscale funnel`. Der Server ist nur
   für Lisas eigene Geräte da.
6. **Abweichungen ansprechen statt raten.** Hat Lisas Pi ein anderes Modell, heißt der Benutzer anders
   oder sieht eine Ausgabe anders aus als hier beschrieben, dann sag das und passe die Befehle an.

## Ziel und Rahmen

- **Ergebnis:** `https://finanz-pi.<dein-tailnet>.ts.net` liefert den Sync-Server. Erreichbar ist er
  nur für deine Geräte im Tailscale-Netz, mit gültigem HTTPS-Zertifikat.
- **Der Server sieht nur Verschlüsseltes.** Verschlüsselt wird in der App mit deinem Passwort.
- **Der Pi muss nicht rund um die Uhr laufen.** Die App arbeitet ohne ihn weiter und gleicht ab, sobald
  er wieder da ist. Im Dauerbetrieb braucht ein Pi 4 oder 5 etwa 3 W, also rund 8 € Strom im Jahr bei
  0,30 €/kWh.

## Was du brauchst

| Was | Hinweis |
|-----|---------|
| Raspberry Pi 4 oder 5 (ein Pi 3B+ geht auch) | 1 GB RAM reicht |
| Netzteil, microSD-Karte ab 16 GB | besser: USB-SSD, SD-Karten sterben gern |
| Netzwerkkabel oder WLAN | Kabel ist zuverlässiger |
| Windows-Laptop | mit Desktop-App und Tailscale |
| iPhone | mit Tailscale-App |
| Passwortmanager | für Sync-Passwort und Zugangsschlüssel |

## Schritt 0 – Den Pi frisch aufsetzen

Der Pi hatte schon ein früheres Leben. Deshalb wird die Karte komplett neu beschrieben. Dann gibt es
auf dem Gerät keine alten Konten, Schlüssel oder Dienste mehr, und er gehört ganz dir.

## Schritt 1 – System auf die Karte

1. Auf dem Laptop in PowerShell einen SSH-Schlüssel erzeugen, falls noch keiner da ist:
   `ssh-keygen -t ed25519`. Alle Fragen mit Enter bestätigen. Den öffentlichen Teil zeigt
   `Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub`.
2. **Raspberry Pi Imager** installieren, dann **Raspberry Pi OS Lite (64-bit)** wählen.
3. In den Einstellungen des Imagers (OS anpassen) Folgendes setzen:
   - Hostname `finanz-pi`
   - Benutzer `lisa` mit eigenem Passwort
   - WLAN, falls kein Kabel
   - Zeitzone `Europe/Berlin` (oder `Europe/Vienna`)
   - Dienste: **SSH aktivieren** mit **„Nur Authentifizierung über öffentliche Schlüssel“** und dem Inhalt
     von `id_ed25519.pub`
4. Karte schreiben, in den Pi stecken, einschalten und zwei Minuten warten.

**Prüfen:** `ssh lisa@finanz-pi.local` kommt ohne Passwortfrage in die Shell. Dort zeigt
`uname -m` die Ausgabe `aarch64`.

## Schritt 2 – Aktualisieren und automatische Sicherheitsupdates

```bash
sudo apt update && sudo apt full-upgrade -y
sudo apt install -y unattended-upgrades git
sudo dpkg-reconfigure -plow unattended-upgrades   # Frage mit „Ja“ beantworten
sudo reboot
```

**Prüfen:** Nach dem Neustart wieder per `ssh` verbinden. `systemctl is-active unattended-upgrades`
zeigt `active`.

## Schritt 3 – Tailscale (Pi, Laptop, iPhone)

1. Auf dem Pi:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
   Den angezeigten Link auf dem Laptop öffnen und mit deinem Konto anmelden.
2. Tailscale auf dem Laptop (tailscale.com/download) und dem iPhone (App Store) installieren und mit
   **demselben Konto** anmelden.
3. In der Admin-Konsole (login.tailscale.com/admin):
   - Unter **DNS** sicherstellen, dass **MagicDNS** an ist, und **HTTPS-Zertifikate** aktivieren.
   - Unter **Machines** beim Eintrag `finanz-pi` im Menü **„Disable key expiry“** wählen. Sonst
     läuft der Zugang nach einigen Monaten ab, und der Sync bricht still ab.

**Prüfen:** `tailscale status` auf dem Pi listet Laptop und iPhone. Auf dem Laptop antwortet
`ping finanz-pi`.

## Schritt 4 – Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
exit   # abmelden und neu per ssh verbinden, damit die Gruppe gilt
```

**Prüfen:** `docker run --rm hello-world` zeigt „Hello from Docker!“.

## Schritt 5 – Sync-Server holen und starten

```bash
git clone https://github.com/LisHltkr/HMDIO.git ~/HMDIO
cd ~/HMDIO/server
openssl rand -hex 32 > token.txt   # Zugangsschlüssel, 64 Zeichen
chmod 600 token.txt
mkdir -p daten
id -u                              # sollte 1000 sein, sonst: sudo chown 1000:1000 daten token.txt
docker compose up -d --build
```

Solange der Branch `sync-handy-installer` noch nicht in `main` ist, gehört `-b sync-handy-installer`
an `git clone`.

- `token.txt` und `daten/` stehen in `.gitignore`. Sie landen nie im Repo.
- Den Zugangsschlüssel zeigst du mit `cat token.txt`. Kopiere ihn in deinen Passwortmanager.
- Heißt dein GitHub-Konto anders als `LisHltkr`, passt du in `compose.yaml` die Adresse unter
  `ERLAUBTE_URSPRUENGE` an.

**Prüfen:** `docker compose ps` zeigt `finanz-sync` als `running` (nach etwa einer Minute `healthy`).
`curl -s http://127.0.0.1:8787/gesund` antwortet mit `ok`.

## Schritt 6 – HTTPS über Tailscale

```bash
sudo tailscale serve --bg 8787
tailscale serve status
```

Die Ausgabe zeigt deine Adresse, etwa `https://finanz-pi.dein-tailnet.ts.net`.

**Prüfen:** Auf dem Laptop (Tailscale an) im Browser `https://finanz-pi.dein-tailnet.ts.net/gesund`
öffnen. Dort steht `ok`, und das Schloss-Symbol zeigt ein gültiges Zertifikat.

## Schritt 7 – Geräte verbinden

1. **Laptop (Desktop-App)** → „Sicherung & Sync“ → **Erstes Gerät**
   - Adresse aus Schritt 6
   - Zugangsschlüssel aus `token.txt`
   - ein **neues Sync-Passwort** mit mindestens 12 Zeichen, am besten ein Satz. Sofort in den
     Passwortmanager damit.
2. **iPhone**
   - Tailscale-App an.
   - In Safari die Web-App öffnen: `https://lishltkr.github.io/HMDIO/` (erst nach dem Merge in `main`).
   - Teilen → **Zum Home-Bildschirm**, dann **vom Home-Bildschirm aus** öffnen. Nur dort hat die App
     ihren eigenen, dauerhaften Speicher.
   - „Sicherung & Sync“ → **Weiteres Gerät**, dieselbe Adresse, derselbe Zugangsschlüssel, dasselbe
     Sync-Passwort.

**Prüfen:** Am Laptop einen Testwert ändern. Am iPhone die App schließen und wieder öffnen: Der Wert
ist da. Unter „Sicherung & Sync“ steht auf beiden Geräten „Sync aktuell“.

## Schritt 8 – Sicherungen (einmal im Monat, fünf Minuten)

- Der Pi hebt die letzten 30 Stände in `daten/versionen/` auf. Das schützt gegen Fehlbedienung, nicht
  gegen eine kaputte SD-Karte.
- **Kopie vom Pi holen.** Der Ordner ist verschlüsselt, die Kopie darf also überall liegen. In
  PowerShell auf dem Laptop:
  `scp -r lisa@finanz-pi:~/HMDIO/server/daten "$env:USERPROFILE\Documents\finanz-pi-$(Get-Date -Format yyyy-MM-dd)"`
- **Ab und zu „Sicherung exportieren“** in der App, als zweite, lesbare Kopie. Die ist
  **unverschlüsselt**, also nur an private Orte damit.

## Schritt 9 – Wartung (einmal im Monat)

```bash
sudo apt update && sudo apt full-upgrade -y
cd ~/HMDIO && git pull
cd server && docker compose build --pull && docker compose up -d
docker image prune -f
df -h /                                          # unter 80 % belegt?
docker compose logs --tail 30                    # auffällige Fehler?
[ -f /var/run/reboot-required ] && sudo reboot   # nur wenn nötig
```

## Fehlerbilder

| Die App sagt … | Wahrscheinliche Ursache | Prüfen | Lösung |
|---|---|---|---|
| „Sync-Server nicht erreichbar“ | Tailscale auf dem Gerät aus, oder der Pi ist aus | Tailscale-App, `tailscale status` | Tailscale an, Pi an. Die Daten auf dem Gerät sind sicher, gesendet wird später. |
| „Der Zugangsschlüssel stimmt nicht“ | Tippfehler, oder `token.txt` wurde neu erzeugt | `cat token.txt` | Schlüssel neu eintragen. Nach einer Änderung von `token.txt`: `docker compose up -d --force-recreate` |
| „liefert keinen ETag“ oder CORS-Fehler | Herkunft fehlt in `ERLAUBTE_URSPRUENGE` | Adresse der Web-App bzw. `http://tauri.localhost` | `compose.yaml` ergänzen, `docker compose up -d` |
| „Passwort falsch oder Tresor beschädigt“ | falsches Sync-Passwort | Passwortmanager | richtiges Passwort |
| Konflikt-Hinweis | Zwei Geräte haben unabhängig gespeichert, etwa ohne Netz | – | Stand wählen. Der andere liegt im Fallschirm. |
| Nach Monaten plötzlich „nicht erreichbar“ | Tailscale-Schlüssel des Pi abgelaufen | Admin-Konsole → Machines | `sudo tailscale up`, dann „Disable key expiry“ |
| `tailscale serve` ohne Zertifikat | HTTPS im Tailnet nicht aktiviert | Admin-Konsole → DNS | HTTPS-Zertifikate aktivieren |

**Sync-Passwort vergessen?** Den Tresor auf dem Pi kann dann niemand mehr öffnen, auch du nicht. Deine
Daten auf den Geräten bleiben aber. So geht es weiter:

1. Auf dem Gerät mit dem besten Stand „Sync ausschalten“.
2. Auf dem Pi: `mv ~/HMDIO/server/daten/tresor.json ~/HMDIO/server/daten/tresor-alt-$(date +%F).json`
3. Auf dem Gerät mit dem besten Stand als **Erstes Gerät** neu einrichten, mit neuem Passwort.
4. Alle anderen Geräte: Sync ausschalten, dann **Weiteres Gerät**.
