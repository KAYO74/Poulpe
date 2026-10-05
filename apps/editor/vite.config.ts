import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

// Chemins relatifs : la même compilation sert le site web et l'appli de bureau Tauri.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Paper.js sans PaperScript (ni son analyseur JavaScript) : seule la géométrie nous sert.
  resolve: { alias: [{ find: /^paper$/, replacement: 'paper/dist/paper-core.js' }] },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Dépendances chargées à la demande (détourage, extensions, mises à jour) : préparées dès le
  // démarrage du serveur de développement, sans rechargement de la page à leur première utilisation.
  optimizeDeps: {
    include: [
      'onnxruntime-web/wasm',
      'quickjs-emscripten-core',
      '@jitl/quickjs-wasmfile-release-sync',
      '@tauri-apps/plugin-updater',
      '@tauri-apps/plugin-process',
    ],
  },
  // La gomme magique calcule dans un Web Worker (module ES).
  worker: { format: 'es' },
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
});
