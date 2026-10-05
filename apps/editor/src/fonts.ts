import { useSyncExternalStore } from 'react';
import { isDesktop } from './io';

// Polices libres (licence OFL) fournies avec l'appli, utilisables hors ligne.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-400-italic.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-700-italic.css';
import '@fontsource/montserrat/latin-400.css';
import '@fontsource/montserrat/latin-400-italic.css';
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/latin-400-italic.css';
import '@fontsource/lora/latin-700.css';
import '@fontsource/oswald/latin-400.css';
import '@fontsource/oswald/latin-700.css';
import '@fontsource/bricolage-grotesque/latin-400.css';
import '@fontsource/bricolage-grotesque/latin-700.css';
import '@fontsource/pacifico/latin-400.css';

export const BUNDLED_FONTS = [
  'Inter',
  'Montserrat',
  'Playfair Display',
  'Lora',
  'Oswald',
  'Bricolage Grotesque',
  'Pacifico',
];

/** Polices présentes sur presque tous les systèmes, en attendant la liste des polices installées. */
const COMMON_FONTS = ['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS'];

let fonts: string[] = [...BUNDLED_FONTS, ...COMMON_FONTS];
const listeners = new Set<() => void>();
let loaded = false;

/** Ajoute les polices installées sur l'ordinateur (appli de bureau, ou navigateur qui l'autorise). */
export async function loadSystemFonts(): Promise<void> {
  if (loaded) return;
  loaded = true;
  let system: string[] = [];
  try {
    if (isDesktop()) {
      const { invoke } = await import('@tauri-apps/api/core');
      system = await invoke<string[]>('list_fonts');
    } else if ('queryLocalFonts' in window) {
      const list = await (
        window as unknown as { queryLocalFonts: () => Promise<{ family: string }[]> }
      ).queryLocalFonts();
      system = list.map((f) => f.family);
    }
  } catch {
    // Permission refusée ou fonction indisponible : on garde la liste de base.
  }
  if (!system.length) return;
  const extra = [...new Set(system)]
    .filter((f) => !BUNDLED_FONTS.includes(f))
    .sort((a, b) => a.localeCompare(b));
  fonts = [...BUNDLED_FONTS, ...extra];
  listeners.forEach((l) => l());
}

export function useFonts(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => fonts,
  );
}

export const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
