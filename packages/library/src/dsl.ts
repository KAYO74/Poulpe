import {
  createEllipse,
  createGroup,
  createLine,
  createPath,
  createPolygon,
  createRect,
  createStar,
  createText,
  DEFAULT_TEXT_STYLE,
  NONE,
  type GroupNode,
  type Paint,
  type PathNode,
  type SceneNode,
  type Stroke,
  type TextNode,
  type TextStyle,
} from '@poulpe/core';

/*
 * Petit langage pour décrire les modèles et les illustrations : des fonctions courtes qui
 * fabriquent les objets du moteur. Les coordonnées sont relatives au plan de travail (ou à
 * l'illustration) ; `place` les décale ensuite à leur position réelle.
 */

export type Lang = 'fr' | 'en';
export type Fill = string | Paint;

/** Texte dans les deux langues de l'interface. */
export interface Tr {
  fr: string;
  en: string;
}

export const tr = (fr: string, en: string): Tr => ({ fr, en });

export function paint(f: Fill | undefined): Paint {
  if (f === undefined) return NONE;
  return typeof f === 'string' ? { type: 'solid', color: f } : f;
}

export const linear = (angle: number, ...colors: string[]): Paint => ({
  type: 'linear',
  angle,
  stops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })),
});

export const radial = (...colors: string[]): Paint => ({
  type: 'radial',
  cx: 0.5,
  cy: 0.5,
  r: 0.5,
  stops: colors.map((color, i) => ({ offset: colors.length === 1 ? 0 : i / (colors.length - 1), color })),
});

interface Common {
  name?: string;
  stroke?: [Fill, number];
  opacity?: number;
  rotation?: number;
}

function finish<T extends SceneNode>(n: T, o: Common = {}): T {
  if (o.name) n.name = o.name;
  if (o.opacity !== undefined) n.opacity = o.opacity;
  if (o.rotation) n.rotation = o.rotation;
  if (o.stroke && 'stroke' in n)
    (n as { stroke: Stroke }).stroke = { paint: paint(o.stroke[0]), width: o.stroke[1] };
  else if ('stroke' in n) (n as { stroke: Stroke }).stroke = { paint: NONE, width: 4 };
  return n;
}

export function rect(
  x: number,
  y: number,
  width: number,
  height: number,
  fill?: Fill,
  o: Common & { radius?: number } = {},
) {
  const n = createRect({ x, y, width, height, name: o.name ?? 'Rectangle' });
  n.fill = paint(fill);
  n.cornerRadius = o.radius ?? 0;
  return finish(n, o);
}

export function ellipse(x: number, y: number, width: number, height: number, fill?: Fill, o: Common = {}) {
  const n = createEllipse({ x, y, width, height, name: o.name ?? 'Ellipse' });
  n.fill = paint(fill);
  return finish(n, o);
}

/** Cercle de centre (cx, cy). */
export const circle = (cx: number, cy: number, r: number, fill?: Fill, o: Common = {}) =>
  ellipse(cx - r, cy - r, r * 2, r * 2, fill, o);

export function star(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: Fill,
  o: Common & { points?: number; inner?: number } = {},
) {
  const n = createStar(
    { x, y, width, height, name: o.name ?? 'Étoile' },
    undefined,
    o.points ?? 5,
    o.inner ?? 0.5,
  );
  n.fill = paint(fill);
  return finish(n, o);
}

export function polygon(
  x: number,
  y: number,
  width: number,
  height: number,
  fill: Fill,
  o: Common & { sides?: number } = {},
) {
  const n = createPolygon({ x, y, width, height, name: o.name ?? 'Polygone' }, undefined, o.sides ?? 6);
  n.fill = paint(fill);
  return finish(n, o);
}

export function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  o: Common = {},
) {
  const n = createLine({
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
    direction: (x2 - x1) * (y2 - y1) >= 0 ? 1 : -1,
    name: o.name ?? 'Ligne',
  });
  return finish(n, { ...o, stroke: [color, width] });
}

/** Tracé SVG dans son propre repère `vb` (largeur × hauteur), étiré sur la boîte donnée. */
export function path(
  d: string,
  vb: [number, number] | [number, number, number, number],
  x: number,
  y: number,
  width: number,
  height: number,
  fill?: Fill,
  o: Common & { evenodd?: boolean } = {},
): PathNode {
  const viewBox =
    vb.length === 2
      ? { x: 0, y: 0, width: vb[0], height: vb[1] }
      : { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };
  const n = createPath({
    x,
    y,
    width,
    height,
    d,
    viewBox,
    name: o.name ?? 'Forme',
    fillRule: o.evenodd ? 'evenodd' : undefined,
  });
  n.fill = paint(fill);
  return finish(n, o);
}

export interface TextOpts extends Common {
  font?: string;
  size?: number;
  weight?: number;
  italic?: boolean;
  align?: TextStyle['align'];
  lineHeight?: number;
  spacing?: number;
  upper?: boolean;
  underline?: boolean;
  /** Largeur fixe : le texte passe à la ligne (bloc de texte). Sinon texte artistique. */
  block?: boolean;
}

/**
 * Texte dans la boîte (x, y, width). Un texte artistique centré ou aligné à droite reste centré
 * ou aligné sur cette boîte quand l'éditeur recalcule sa largeur.
 */
export function text(
  x: number,
  y: number,
  width: number,
  content: string,
  color: Fill,
  o: TextOpts = {},
): TextNode {
  const size = o.size ?? 48;
  const lines = content.split('\n').length;
  const lh = o.lineHeight ?? 1.2;
  const n = createText({
    x,
    y,
    width,
    height: size * lh * lines,
    text: content,
    autoWidth: !o.block,
    name: o.name ?? 'Texte',
  });
  n.style = {
    ...DEFAULT_TEXT_STYLE,
    fontFamily: o.font ?? 'Inter',
    fontSize: size,
    fontWeight: o.weight ?? 400,
    italic: o.italic ?? false,
    align: o.align ?? 'left',
    lineHeight: lh,
    letterSpacing: o.spacing ?? 0,
    uppercase: o.upper ?? false,
    underline: o.underline ?? false,
  };
  n.fill = paint(color);
  return finish(n, o);
}

export function group(
  children: SceneNode[],
  name: string,
  o: { clip?: boolean; opacity?: number } = {},
): GroupNode {
  const g = createGroup(children, name);
  g.clip = o.clip ?? false;
  if (o.opacity !== undefined) g.opacity = o.opacity;
  // Boîte du groupe : l'éditeur la recalcule, mais un aperçu en a besoin tout de suite.
  fitGroup(g);
  return g;
}

function fitGroup(g: GroupNode) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const c of g.children) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + c.width);
    y1 = Math.max(y1, c.y + c.height);
  }
  if (x0 !== Infinity) Object.assign(g, { x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
}
