# Sync-Server als Container (Betrieb: docs/pi-plan.md).
# Node 24 führt die TypeScript-Datei direkt aus, ein Build-Schritt ist nicht nötig.
FROM node:24-alpine
WORKDIR /app
COPY package.json sync-server.ts ./
ENV NODE_ENV=production DATEN_ORDNER=/daten PORT=8787
# Ohne Root-Rechte: Der Benutzer „node“ (uid 1000) bringt das Image mit.
USER node
EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8787/gesund || exit 1
CMD ["node", "sync-server.ts"]
