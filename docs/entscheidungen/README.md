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
