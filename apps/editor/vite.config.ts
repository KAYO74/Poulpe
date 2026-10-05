import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

// Chemins relatifs : la même compilation sert le site web et l'appli de bureau Tauri.
export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
});
