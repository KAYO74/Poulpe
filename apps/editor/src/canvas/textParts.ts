import {
  findNode,
  indexAtPoint,
  needsFlow,
  worldToLocal,
  type PoulpeDocument,
  type TextLayout,
  type TextNode,
  type Vec,
} from '@poulpe/core';
import { cachedFlow, cachedLayout, measureText } from '@poulpe/render';

/*
 * Mise en page du texte en cours d'édition, cadre par cadre : un texte simple n'a qu'une part,
 * une chaîne de cadres liés en a une par cadre. Les indices sont toujours ceux du texte complet.
 */

export interface TextPart {
  node: TextNode;
  layout: TextLayout;
  start: number;
  end: number;
}

export function editParts(doc: PoulpeDocument, id: string): TextPart[] {
  const n = findNode(doc, id)?.node;
  if (n?.type !== 'text') return [];
  if (needsFlow(doc, n)) {
    const parts = cachedFlow(doc, id, null).parts.filter((p) => p.layout.lines.length);
    if (parts.length) return parts;
  }
  return [{ node: n, layout: cachedLayout(n), start: 0, end: n.text.length }];
}

/** Part qui contient le curseur d'indice `i`. */
export function partAt(parts: TextPart[], i: number): TextPart {
  for (const p of parts) if (i >= p.start && i < p.end) return p;
  for (let k = parts.length - 1; k >= 0; k--) if (parts[k].start <= i) return parts[k];
  return parts[0];
}

/** Indice du texte sous un point du monde, s'il tombe dans un des cadres (ou au plus près si `clamp`). */
export function indexAtWorld(parts: TextPart[], p: Vec, clamp: boolean): number | null {
  let best: { part: TextPart; local: Vec; d: number } | null = null;
  for (const part of parts) {
    const local = worldToLocal(part.node, p);
    const dx = Math.max(0, -local.x, local.x - part.node.width);
    const dy = Math.max(0, -local.y, local.y - part.node.height);
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { part, local, d };
  }
  if (!best || (!clamp && best.d > 0)) return null;
  return indexAtPoint(best.part.layout, best.local.x, best.local.y, measureText);
}
