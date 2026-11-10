# Entscheidungen

Jede Entscheidung, bei der es mehrere vernünftige Wege gab, bekommt eine kurze Notiz
(„Architecture Decision Record“). Notizen werden nie gelöscht. Überholte Notizen
bekommen den Status „ersetzt durch NNNN“.

## Aufbau einer Notiz

```
# NNNN – Titel als Aussage

- Datum: JJJJ-MM-TT
- Status: gilt | vorgeschlagen | ersetzt durch NNNN

## Ausgangslage
Was ist das Problem, was ist gegeben?

## Optionen
Jede Option mit ihren Folgen, die gewählte zuerst.

## Entscheidung
Was gilt ab jetzt, in einem Satz, und warum.

## Folgen
Was wird dadurch leichter, was schwerer, was ist noch offen?
```

## Verzeichnis

| Nr. | Entscheidung | Status |
|-----|--------------|--------|
| [0001](0001-installer-aus-github-actions.md) | Installer entstehen in GitHub Actions, nicht auf einem PC | gilt |
| [0002](0002-ende-zu-ende-verschluesselung.md) | Daten werden im Gerät verschlüsselt, bevor sie es verlassen | gilt |
| [0003](0003-sync-ueber-eigenen-pi.md) | Sync über einen eigenen Pi, erreichbar nur über Tailscale | gilt |
| [0004](0004-handy-als-web-app.md) | Aufs iPhone als Web-App vom Home-Bildschirm, nicht als native App | gilt |
