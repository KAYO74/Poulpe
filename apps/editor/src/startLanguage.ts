import { getLang, hasSavedLang, setLang, type Lang } from './i18n';
import { isDesktop } from './io';
import { ui } from './store';

/** Dernière langue choisie dans l'installeur Windows et déjà appliquée. */
const APPLIED = 'poulpe.installLang';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

/** Vrai si l'appli a déjà servi sur cet ordinateur (préférences, espaces, raccourcis…). */
function usedBefore(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) if (localStorage.key(i)?.startsWith('poulpe.')) return true;
  } catch {
    /* stockage indisponible */
  }
  return false;
}

let chosen: (() => void) | null = null;

/**
 * Langue de l'interface au lancement de l'appli de bureau :
 * - Windows : celle choisie dans l'installeur, appliquée une fois (une mise à jour qui garde la même
 *   langue ne remplace pas un changement fait ensuite dans les Préférences) ;
 * - sinon, au tout premier lancement, une fenêtre demande la langue (macOS et Linux n'ont pas
 *   d'assistant d'installation).
 * La version navigateur garde la langue du navigateur. Résolu une fois la langue choisie.
 */
export async function chooseStartLanguage(): Promise<void> {
  if (!isDesktop()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  const installer = await invoke<string | null>('installer_language').catch(() => null);
  if (installer === 'fr' || installer === 'en') {
    if (read(APPLIED) !== installer) {
      setLang(installer);
      write(APPLIED, installer);
    }
    return;
  }
  if (hasSavedLang()) return;
  if (usedBefore()) {
    setLang(getLang());
    return;
  }
  await new Promise<void>((resolve) => {
    chosen = resolve;
    ui.set({ dialog: 'language' });
  });
}

/** Choix fait dans la fenêtre du premier lancement. */
export function pickStartLanguage(l: Lang): void {
  setLang(l);
  ui.set({ dialog: null });
  chosen?.();
  chosen = null;
}
