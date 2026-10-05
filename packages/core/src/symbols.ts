import { newId } from './ids';
import { scaleNode, translateNode } from './tree';
import type { Box } from './geometry';
import type { PoulpeDocument, SceneNode, Symbol as PoulpeSymbol, SymbolNode } from './types';

/*
 * Symboles : un contenu réutilisable, affiché par des instances. Le contenu est rangé une seule
 * fois dans le document (`doc.symbols`), avec la boîte dans laquelle il a été créé ; chaque
 * instance le ramène dans sa propre boîte. Modifier le symbole met donc à jour toutes les
 * instances d'un coup, comme dans Affinity.
 */

export function findSymbol(doc: PoulpeDocument, id: string): PoulpeSymbol | null {
  return doc.symbols?.[id] ?? null;
}

/** Copie d'un objet avec de nouveaux identifiants (pour détacher ou dupliquer un symbole). */
export function cloneSymbolNodes(nodes: SceneNode[]): SceneNode[] {
  const copy = structuredClone(nodes) as SceneNode[];
  const renumber = (n: SceneNode) => {
    n.id = newId('node');
    if (n.type === 'group') n.children.forEach(renumber);
  };
  copy.forEach(renumber);
  return copy;
}

/**
 * Objets d'une instance, ramenés dans sa boîte (position, taille et rotation comprises). Les
 * copies sont neuves à chaque appel : le rendu les dessine, personne ne les garde.
 */
export function symbolContent(doc: PoulpeDocument, node: SymbolNode): SceneNode[] {
  const sym = findSymbol(doc, node.symbolId);
  if (!sym) return [];
  const box = sym.box;
  const sx = node.width / Math.max(1e-6, box.width),
    sy = node.height / Math.max(1e-6, box.height);
  const children = structuredClone(sym.children) as SceneNode[];
  for (const c of children) {
    translateNode(c, -box.x, -box.y);
    scaleNode(c, sx, sy, { x: 0, y: 0 }, true);
    translateNode(c, node.x, node.y);
  }
  return children;
}

/** Boîte d'un symbole telle qu'elle a été enregistrée. */
export function symbolBox(sym: PoulpeSymbol): Box {
  return { ...sym.box };
}

/** Instances d'un symbole dans tout le document. */
export function symbolInstances(doc: PoulpeDocument, symbolId: string): SymbolNode[] {
  const out: SymbolNode[] = [];
  const visit = (nodes: SceneNode[]) => {
    for (const n of nodes) {
      if (n.type === 'symbol' && n.symbolId === symbolId) out.push(n);
      else if (n.type === 'group') visit(n.children);
    }
  };
  for (const ab of doc.artboards) visit(ab.children);
  return out;
}
