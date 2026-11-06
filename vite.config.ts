import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tauri erwartet einen festen Port und soll Rust-Dateien nicht beobachten.
// WEB_BASIS: Unterpfad der Web-App auf GitHub Pages (z. B. "/HMDIO/"); Desktop und Entwicklung nutzen "/".
export default defineConfig({
  base: process.env.WEB_BASIS ?? '/',
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
