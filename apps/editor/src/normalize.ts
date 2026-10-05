import { layoutText, type PoulpeDocument, type SceneNode } from '@poulpe/core';
import { measureText } from '@poulpe/render';

/**
 * Recalcule la taille des textes, qui dépend des polices du navigateur. Un texte artistique garde
 * son bord gauche, son centre ou son bord droit selon son alignement.
 */
export function normalizeTexts(doc: PoulpeDocument): void {
  const visit = (nodes: SceneNode[]) => {
    for (const n of nodes) {
      if (n.type === 'group') visit(n.children);
      else if (n.type === 'text') {
        const layout = layoutText(n, measureText);
        if (n.autoWidth) {
          const w = Math.max(1, layout.width);
          if (n.style.align === 'center') n.x += (n.width - w) / 2;
          else if (n.style.align === 'right') n.x += n.width - w;
          n.width = w;
        }
        n.height = layout.height;
      }
    }
  };
  for (const ab of doc.artboards) visit(ab.children);
}

/** Polices utilisées par un document, au format CSS (`700 italic 16px "Oswald"`). */
export function documentFonts(doc: PoulpeDocument): string[] {
  const set = new Set<string>();
  const add = (family: string, weight: number, italic: boolean) =>
    set.add(`${italic ? 'italic ' : ''}${weight} 16px "${family}"`);
  const visit = (nodes: SceneNode[]) => {
    for (const n of nodes) {
      if (n.type === 'group') visit(n.children);
      else if (n.type === 'text') {
        add(n.style.fontFamily, n.style.fontWeight, n.style.italic);
        for (const r of n.runs ?? [])
          add(
            r.style.fontFamily ?? n.style.fontFamily,
            r.style.fontWeight ?? n.style.fontWeight,
            r.style.italic ?? n.style.italic,
          );
      }
    }
  };
  for (const ab of doc.artboards) visit(ab.children);
  return [...set];
}

/** Charge les polices d'un document avant de mesurer ou de dessiner ses textes. */
export async function loadDocumentFonts(doc: PoulpeDocument): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(documentFonts(doc).map((f) => document.fonts.load(f).catch(() => [])));
}
