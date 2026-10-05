import {
  commandsBounds,
  createEllipse,
  createLine,
  createPath,
  createPolygon,
  createRect,
  createStar,
  createText,
  defaultStyle,
  normalizeHex,
  parseSvgPath,
  type Paint,
  type SceneNode,
} from '@poulpe/core';

/*
 * Ce qu'une extension peut lire et modifier dans le document. Les extensions ne voient que des
 * copies en JSON et ne passent que par ces fonctions : elles n'ont accès ni aux fichiers, ni à
 * Internet, ni au reste de l'appli.
 */

export const SHAPE_TYPES = ['rect', 'ellipse', 'polygon', 'star', 'line', 'text', 'path'] as const;
type ShapeType = (typeof SHAPE_TYPES)[number];

export interface ShapeSpec {
  type: ShapeType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  /** Couleur de remplissage `#rrggbb` (ou `#rrggbbaa`), ou null pour aucun. */
  fill?: string | null;
  stroke?: string | null;
  strokeWidth?: number;
  opacity?: number;
  rotation?: number;
  cornerRadius?: number;
  sides?: number;
  points?: number;
  innerRatio?: number;
  /** Texte : son contenu, sa taille et sa police. */
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  /** Tracé : données SVG ; la boîte est celle du tracé si elle n'est pas donnée. */
  d?: string;
}

const num = (v: unknown, fallback: number, min = -1e6, max = 1e6): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

function paint(v: unknown): Paint | undefined {
  if (v === null || v === 'none') return { type: 'none' };
  if (typeof v !== 'string') return undefined;
  const c = normalizeHex(v);
  return c ? { type: 'solid', color: c } : undefined;
}

/** Nouvel objet d'après la description d'une extension. */
export function createFromSpec(spec: ShapeSpec): SceneNode {
  if (!spec || !SHAPE_TYPES.includes(spec.type)) throw new Error(`type inconnu : ${String(spec?.type)}`);
  const box = {
    x: num(spec.x, 0),
    y: num(spec.y, 0),
    width: num(spec.width, 100, 0),
    height: num(spec.height, 100, 0),
    ...(typeof spec.name === 'string' ? { name: spec.name.slice(0, 200) } : {}),
  };
  const style = defaultStyle();
  let node: SceneNode;
  switch (spec.type) {
    case 'rect':
      node = { ...createRect(box, style), cornerRadius: num(spec.cornerRadius, 0, 0) };
      break;
    case 'ellipse':
      node = createEllipse(box, style);
      break;
    case 'polygon':
      node = createPolygon(box, style, Math.round(num(spec.sides, 6, 3, 100)));
      break;
    case 'star':
      node = createStar(
        box,
        style,
        Math.round(num(spec.points, 5, 3, 100)),
        num(spec.innerRatio, 0.5, 0.05, 1),
      );
      break;
    case 'line':
      node = createLine(box, style);
      break;
    case 'text': {
      const text = createText({ ...box, text: String(spec.text ?? '').slice(0, 100_000) }, style);
      text.style.fontSize = num(spec.fontSize, text.style.fontSize, 1, 2000);
      if (typeof spec.fontFamily === 'string') text.style.fontFamily = spec.fontFamily.slice(0, 200);
      text.style.fontWeight = Math.round(num(spec.fontWeight, text.style.fontWeight, 100, 900));
      node = text;
      break;
    }
    case 'path': {
      const d = String(spec.d ?? '');
      const b = commandsBounds(parseSvgPath(d));
      if (!b) throw new Error('tracé vide');
      const vb = { x: b.x, y: b.y, width: Math.max(b.width, 1e-3), height: Math.max(b.height, 1e-3) };
      const target =
        spec.width !== undefined || spec.height !== undefined || spec.x !== undefined || spec.y !== undefined
          ? { ...box, width: num(spec.width, vb.width, 0), height: num(spec.height, vb.height, 0) }
          : { ...vb, name: box.name };
      node = createPath({ ...target, d, viewBox: vb }, style);
      break;
    }
  }
  applyPatch(node, spec);
  return node;
}

/** Champs qu'une extension peut changer sur un objet existant. */
export function applyPatch(
  node: SceneNode,
  patch: Partial<ShapeSpec> & { visible?: boolean; locked?: boolean },
): void {
  if (!patch || typeof patch !== 'object') return;
  if (patch.x !== undefined) node.x = num(patch.x, node.x);
  if (patch.y !== undefined) node.y = num(patch.y, node.y);
  if (patch.width !== undefined) node.width = num(patch.width, node.width, 0);
  if (patch.height !== undefined) node.height = num(patch.height, node.height, 0);
  if (patch.rotation !== undefined) node.rotation = num(patch.rotation, node.rotation, -3600, 3600);
  if (patch.opacity !== undefined) node.opacity = num(patch.opacity, node.opacity, 0, 1);
  if (typeof patch.name === 'string') node.name = patch.name.slice(0, 200);
  if (typeof patch.visible === 'boolean') node.visible = patch.visible;
  if (typeof patch.locked === 'boolean') node.locked = patch.locked;
  if ('fill' in node) {
    const f = patch.fill !== undefined ? paint(patch.fill) : undefined;
    if (f) node.fill = f;
    const s = patch.stroke !== undefined ? paint(patch.stroke) : undefined;
    if (s) node.stroke = { ...node.stroke, paint: s };
    if (patch.strokeWidth !== undefined)
      node.stroke = { ...node.stroke, width: num(patch.strokeWidth, 1, 0, 1000) };
  }
  if (node.type === 'rect' && patch.cornerRadius !== undefined)
    node.cornerRadius = num(patch.cornerRadius, 0, 0);
  if (node.type === 'text' && typeof patch.text === 'string') {
    node.text = patch.text.slice(0, 100_000);
    delete node.runs;
  }
}

/** Copie JSON d'un objet pour une extension (sans les pixels des images). */
export function snapshot(node: SceneNode): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(node)) as Record<string, unknown>;
  if (node.type === 'group') out.children = node.children.map(snapshot);
  if ('fill' in node && node.fill.type === 'solid') out.fillColor = node.fill.color;
  return out;
}
