import paper from 'paper';
import { PaperOffset } from 'paperjs-offset';
import { pathToSvg, type PathCommand } from './geometry';
import { exactBounds } from './bezier';
import { parseSvgPath } from './path';
import { findNode, topLevelIds, walkDocument } from './tree';
import type { Parent, PathNode, PoulpeDocument, SceneNode, StrokeJoin } from './types';
import { createPath } from './factory';
import { worldOutline } from './vector';

/*
 * Opérations de géométrie (union, soustraction, intersection, exclusion, division) et décalage
 * de tracé. Les calculs sont confiés à Paper.js, qui garde les courbes de Bézier intactes.
 */

export type BooleanOp = 'unite' | 'subtract' | 'intersect' | 'exclude' | 'divide';

let scope: paper.PaperScope | null = null;

function ps(): paper.PaperScope {
  if (!scope) {
    scope = new paper.PaperScope();
    scope.setup(new scope.Size(1, 1));
  }
  scope.activate();
  return scope;
}

function toItem(cmds: PathCommand[], fillRule: 'nonzero' | 'evenodd' = 'nonzero'): paper.PathItem {
  const s = ps();
  const item = new s.CompoundPath({ pathData: pathToSvg(cmds, 4), insert: false });
  item.fillRule = fillRule;
  return item;
}

function fromItem(item: paper.PathItem): PathCommand[] {
  return parseSvgPath(item.pathData);
}

function isEmpty(item: paper.PathItem): boolean {
  return item.isEmpty() || Math.abs((item as paper.CompoundPath).area) < 0.01;
}

/** Applique une opération à des contours, du dessous vers le dessus. La division renvoie plusieurs morceaux. */
export function booleanCommands(
  shapes: { cmds: PathCommand[]; fillRule?: 'nonzero' | 'evenodd' }[],
  op: BooleanOp,
): { cmds: PathCommand[]; source: number }[] {
  if (!shapes.length) return [];
  const items = shapes.map((s) => toItem(s.cmds, s.fillRule));
  const opts = { insert: false } as const;
  if (op === 'divide') {
    // Chaque région du recouvrement devient un morceau, qui prend le style de l'objet du dessus.
    let pieces: { item: paper.PathItem; source: number }[] = [];
    items.forEach((shape, i) => {
      const next: typeof pieces = [];
      let rest: paper.PathItem = shape;
      for (const pc of pieces) {
        const outside = pc.item.subtract(shape, opts);
        const inside = pc.item.intersect(shape, opts);
        if (!isEmpty(outside)) next.push({ item: outside, source: pc.source });
        if (!isEmpty(inside)) next.push({ item: inside, source: i });
        rest = rest.subtract(pc.item, opts);
      }
      if (!isEmpty(rest)) next.push({ item: rest, source: i });
      pieces = next;
    });
    return pieces.map((p) => ({ cmds: fromItem(p.item), source: p.source }));
  }
  let result: paper.PathItem = items[0];
  for (const item of items.slice(1)) {
    if (op === 'unite') result = result.unite(item, opts);
    else if (op === 'subtract') result = result.subtract(item, opts);
    else if (op === 'intersect') result = result.intersect(item, opts);
    else result = result.exclude(item, opts);
  }
  return isEmpty(result) ? [] : [{ cmds: fromItem(result), source: 0 }];
}

/** Nouvel objet tracé à partir d'un contour dans le monde, avec le style d'un objet existant. */
export function pathNodeFromWorld(cmds: PathCommand[], style: SceneNode, name: string): PathNode {
  const b = exactBounds(cmds) ?? { x: 0, y: 0, width: 0, height: 0 };
  const leaf = firstStyled(style);
  const node = createPath({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    d: pathToSvg(cmds),
    viewBox: b,
    fillRule: 'evenodd',
    name,
  });
  if (leaf) {
    node.fill = structuredClone(leaf.fill);
    node.stroke = structuredClone(leaf.stroke);
  }
  node.opacity = style.opacity;
  node.blendMode = style.blendMode;
  if (style.effects) node.effects = structuredClone(style.effects);
  return node;
}

function firstStyled(n: SceneNode): Extract<SceneNode, { fill: unknown }> | null {
  if (n.type === 'group') {
    for (const c of n.children) {
      const s = firstStyled(c);
      if (s) return s;
    }
    return null;
  }
  return n.type === 'image' ? null : n;
}

/**
 * Remplace les objets sélectionnés par le résultat d'une opération de géométrie. Comme dans
 * Affinity, le résultat prend le style de l'objet du dessous (la division garde le style de
 * chaque morceau) et la place de l'objet du dessus. Renvoie les nouveaux ids, ou null si la
 * sélection ne s'y prête pas (moins de deux objets, texte ou image).
 */
export function applyBoolean(
  doc: PoulpeDocument,
  ids: string[],
  op: BooleanOp,
  name: string,
): string[] | null {
  const top = new Set(topLevelIds(doc, ids));
  const ordered = [...walkDocument(doc)].filter((l) => top.has(l.node.id) && !l.node.locked);
  if (ordered.length < 2) return null;
  const outlines = ordered.map((l) => worldOutline(l.node));
  if (outlines.some((o) => o === null)) return null;
  const shapes = ordered.map((l, i) => ({
    cmds: outlines[i]!,
    fillRule: l.node.type === 'path' ? l.node.fillRule : undefined,
  }));
  const results = booleanCommands(shapes, op);
  const anchor = ordered[ordered.length - 1];
  const parent: Parent = anchor.parent;
  const created = results.map((r) =>
    pathNodeFromWorld(r.cmds, ordered[op === 'divide' ? r.source : 0].node, name),
  );
  // Insertion à la place de l'objet du dessus, puis suppression des originaux.
  const removed = new Set(ordered.map((l) => l.node.id));
  const index = parent.children.indexOf(anchor.node);
  parent.children.splice(index + 1, 0, ...created);
  const strip = (p: Parent) => {
    p.children = p.children.filter((n) => !removed.has(n.id));
    p.children.forEach((c) => c.type === 'group' && strip(c));
  };
  doc.artboards.forEach(strip);
  return created.map((n) => n.id);
}

/**
 * Décale un contour vers l'extérieur (distance positive) ou l'intérieur. Un tracé ouvert devient
 * le contour de son trait, d'épaisseur double de la distance.
 */
export function offsetCommands(
  cmds: PathCommand[],
  distance: number,
  join: StrokeJoin = 'round',
  closed = true,
): PathCommand[] {
  const s = ps();
  const item = new s.CompoundPath({ pathData: pathToSvg(cmds, 4), insert: false });
  const children = item.children as paper.Path[];
  const open = !closed || children.some((c) => !c.closed);
  const res = open
    ? PaperOffset.offsetStroke(item, Math.abs(distance), { join, cap: 'round', insert: false })
    : PaperOffset.offset(item, distance, { join, insert: false });
  return fromItem(res as paper.PathItem);
}

/** Décale le contour d'un objet ; le nouvel objet garde son style. Renvoie son id. */
export function applyOffset(
  doc: PoulpeDocument,
  id: string,
  distance: number,
  join: StrokeJoin,
  name: string,
): string | null {
  const loc = findNode(doc, id);
  if (!loc) return null;
  const outline = worldOutline(loc.node);
  if (!outline?.length) return null;
  const cmds = offsetCommands(outline, distance, join, loc.node.type !== 'line');
  if (!cmds.length) return null;
  const node = pathNodeFromWorld(cmds, loc.node, name);
  if (loc.node.type === 'line') {
    // Le contour d'une ligne se remplit avec la couleur de son trait.
    node.fill = loc.node.stroke.paint;
    node.stroke = { ...loc.node.stroke, paint: { type: 'none' } };
  }
  loc.parent.children.splice(loc.index + 1, 0, node);
  return node.id;
}

/**
 * Transforme le trait d'un objet en forme pleine (« Contour en tracé ») : la forme a la couleur du
 * trait. Les pointillés et les flèches ne sont pas repris.
 */
export function applyOutlineStroke(doc: PoulpeDocument, id: string, name: string): string | null {
  const loc = findNode(doc, id);
  const n = loc?.node;
  if (!loc || !n || n.type === 'group' || n.type === 'text' || n.type === 'image') return null;
  if (n.stroke.paint.type === 'none' || n.stroke.width <= 0) return null;
  const outline = worldOutline(n);
  if (!outline?.length) return null;
  const s = ps();
  const item = new s.CompoundPath({ pathData: pathToSvg(outline, 4), insert: false });
  if (n.type !== 'line' && !(n.type === 'path' && (item.children as paper.Path[]).some((c) => !c.closed)))
    (item.children as paper.Path[]).forEach((c) => (c.closed = true));
  const res = PaperOffset.offsetStroke(item, n.stroke.width / 2, {
    join: n.stroke.join ?? 'round',
    cap: n.stroke.cap === 'butt' ? 'butt' : 'round',
    insert: false,
  }) as paper.PathItem;
  const node = pathNodeFromWorld(fromItem(res), n, name);
  node.fill = n.stroke.paint;
  node.stroke = { paint: { type: 'none' }, width: n.stroke.width };
  loc.parent.children.splice(loc.index + 1, 0, node);
  // Le remplissage d'origine reste un objet à part, sans trait.
  if (n.type === 'line' || n.fill.type === 'none') loc.parent.children.splice(loc.index, 1);
  else n.stroke = { ...n.stroke, paint: { type: 'none' } };
  return node.id;
}
