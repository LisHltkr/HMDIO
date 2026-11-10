# Sync-Server

Ein kleiner Server, der genau einen **verschlüsselten Tresor** aufbewahrt, damit Laptop und iPhone
dieselben Daten haben. Er kann die Daten nicht lesen, denn verschlüsselt wird im Gerät
([Entscheidung 0002](../docs/entscheidungen/0002-ende-zu-ende-verschluesselung.md)). Wie Abgleich
und Konflikte funktionieren, steht in [Entscheidung 0003](../docs/entscheidungen/0003-sync-ueber-eigenen-pi.md).

- `sync-server.ts`: der Server, ohne Abhängigkeiten. Node ≥ 22.18 führt TypeScript direkt aus.
- `sync-server.test.ts`: Tests, die mit `pnpm test` im Hauptordner laufen.
- `Dockerfile` und `compose.yaml`: Betrieb als gehärteter Container auf dem Pi.

**Auf dem Pi einrichten:** Schritt für Schritt in [docs/pi-plan.md](../docs/pi-plan.md).

**Lokal ausprobieren** (im Hauptordner, mit einem Test-Zugangsschlüssel):

```bash
TOKEN=testtesttesttesttesttesttesttest ERLAUBTE_URSPRUENGE=http://localhost:1420 pnpm sync-server
```

In der App unter „Sicherung & Sync“ trägst du dann `http://localhost:8787` als Adresse ein.
`http` ist nur für `localhost` erlaubt, überall sonst verlangt die App HTTPS.
