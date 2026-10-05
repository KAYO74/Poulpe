import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { layoutText } from '@poulpe/core';
import { measureText } from '@poulpe/render';
import { App } from './App';
import { startDrafts } from './drafts';
import { loadSystemFonts } from './fonts';
import { getLang } from './i18n';
import { isDesktop, openPath } from './io';
import { editor, ui } from './store';
import './styles.css';

document.documentElement.lang = getLang();

// La taille des textes dépend des polices : elle est recalculée après chaque modification.
editor.setNormalizer((doc) => {
  const visit = (nodes: (typeof doc.artboards)[number]['children']) => {
    for (const n of nodes) {
      if (n.type === 'group') visit(n.children);
      else if (n.type === 'text') {
        const layout = layoutText(n, measureText);
        if (n.autoWidth) {
          const w = Math.max(1, layout.width);
          // Un texte artistique garde son bord gauche, son centre ou son bord droit selon l'alignement.
          if (n.style.align === 'center') n.x += (n.width - w) / 2;
          else if (n.style.align === 'right') n.x += n.width - w;
          n.width = w;
        }
        n.height = layout.height;
      }
    }
  };
  for (const ab of doc.artboards) visit(ab.children);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void loadSystemFonts();
void startDrafts();
if (isDesktop() || location.search.includes('bench'))
  void import('./bench').then((b) => b.maybeRunBenchmark(isDesktop()));

if (isDesktop()) {
  // Fichier passé au lancement (double-clic sur un .poulpe) ou ouvert pendant que l'appli tourne.
  import('@tauri-apps/api/core').then(async ({ invoke }) => {
    const path = await invoke<string | null>('opened_file').catch(() => null);
    if (path) await openPath(path);
  });
  import('@tauri-apps/api/event').then(({ listen }) => {
    void listen<string>('open-file', (e) => void openPath(e.payload));
  });
}

// Accès pour les tests de bout en bout.
(window as unknown as { poulpe: unknown }).poulpe = { editor, ui };
