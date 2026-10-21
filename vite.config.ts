import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Tauri erwartet einen festen Port und soll Rust-Dateien nicht beobachten.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  test: { include: ['src/**/*.test.ts'] },
});
