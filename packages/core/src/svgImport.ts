import { exactBounds } from './bezier';
import { formatColor, normalizeHex, parseColor } from './color';
import { ellipsePath, pathToSvg, roundRectPath, type PathCommand, type Vec } from './geometry';
import { createGroup, createImage, createPath, createText, NONE } from './factory';
import { newId } from './ids';
import { parseSvgPath } from './path';
import type { Asset, GradientStop, Paint, SceneNode, Stroke, StrokeCap, StrokeJoin } from './types';
import { mapCommands } from './vector';

/*
 * Import de fichiers SVG en objets modifiables. Les formes deviennent des tracés dans le repère
 * du document (transformations appliquées), les groupes restent des groupes.
 *
 * Pris en charge : path, rect, circle, ellipse, line, polyline, polygon, g, use, image (données
 * intégrées), text (simple), dégradés linéaires et radiaux, styles en attributs, en `style` et
 * en feuille `<style>` simple (sélecteurs de balise, de classe et d'identifiant).
 * Ignorés : masques, écrêtages, motifs, filtres.
 */

// ————— Lecture XML —————

export interface XmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e: string) => {
    if (e[0] === '#')
      return String.fromCodePoint(
        e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10),
      );
    return ENTITIES[e] ?? all;
  });
}

/** Petit lecteur XML, suffisant pour les fichiers SVG. */
export function parseXml(src: string): XmlElement | null {
  const root: XmlElement = { tag: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    const top = stack[stack.length - 1];
    if (lt < 0) {
      top.text += decodeEntities(src.slice(i));
      break;
    }
    if (lt > i) top.text += decodeEntities(src.slice(i, lt));
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt);
      i = end < 0 ? src.length : end + 3;
    } else if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt);
      top.text += src.slice(lt + 9, end < 0 ? src.length : end);
      i = end < 0 ? src.length : end + 3;
    } else if (src[lt + 1] === '?' || src[lt + 1] === '!') {
      // Déclaration XML, DOCTYPE (avec ses éventuelles entités entre crochets).
      let depth = 0,
        j = lt;
      for (; j < src.length; j++) {
        if (src[j] === '[') depth++;
        else if (src[j] === ']') depth--;
        else if (src[j] === '>' && depth <= 0) break;
      }
      i = j + 1;
    } else if (src[lt + 1] === '/') {
      const end = src.indexOf('>', lt);
      const tag = src.slice(lt + 2, end).trim();
      while (stack.length > 1) {
        const el = stack.pop()!;
        if (el.tag === tag) break;
      }
      i = end + 1;
    } else {
      const re = /<([^\s/>]+)|\s*([^\s=/>]+)\s*=\s*("[^"]*"|'[^']*')|\s*(\/?)>/y;
      re.lastIndex = lt;
      const el: XmlElement = { tag: '', attrs: {}, children: [], text: '' };
      let m: RegExpExecArray | null;
      let closed = false,
        selfClosing = false;
      while ((m = re.exec(src))) {
        if (m[1]) el.tag = m[1];
        else if (m[2]) el.attrs[m[2]] = decodeEntities(m[3].slice(1, -1));
        else {
          closed = true;
          selfClosing = m[4] === '/';
          break;
        }
      }
      if (!closed || !el.tag) return null;
      i = re.lastIndex;
      // Les préfixes d'espace de noms (svg:path) sont ignorés.
      el.tag = el.tag.replace(/^\w+:/, '');
      top.children.push(el);
      if (!selfClosing) stack.push(el);
    }
  }
  return root.children.find((c) => c.tag === 'svg') ?? null;
}

// ————— Matrices —————

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function apply(m: Matrix, p: Vec): Vec {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

function parseTransform(s: string | undefined): Matrix {
  let m: Matrix = IDENTITY;
  if (!s) return m;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let r: RegExpExecArray | null;
  while ((r = re.exec(s))) {
    const a = (r[2].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
    let t: Matrix = IDENTITY;
    switch (r[1]) {
      case 'matrix':
        if (a.length >= 6) t = [a[0], a[1], a[2], a[3], a[4], a[5]];
        break;
      case 'translate':
        t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
        break;
      case 'scale':
        t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
        break;
      case 'rotate': {
        const rad = ((a[0] ?? 0) * Math.PI) / 180;
        const c = Math.cos(rad),
          sn = Math.sin(rad);
        const cx = a[1] ?? 0,
          cy = a[2] ?? 0;
        t = multiply(multiply([1, 0, 0, 1, cx, cy], [c, sn, -sn, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]);
        break;
      }
      case 'skewX':
        t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case 'skewY':
        t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    m = multiply(m, t);
  }
  return m;
}

// ————— Styles —————

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  aqua: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  olive: '#808000',
  lime: '#00ff00',
  teal: '#008080',
  navy: '#000080',
  purple: '#800080',
  orange: '#ffa500',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  gold: '#ffd700',
  coral: '#ff7f50',
  crimson: '#dc143c',
  indigo: '#4b0082',
  violet: '#ee82ee',
  tomato: '#ff6347',
  salmon: '#fa8072',
  khaki: '#f0e68c',
  beige: '#f5f5dc',
  ivory: '#fffff0',
  lavender: '#e6e6fa',
  turquoise: '#40e0d0',
  tan: '#d2b48c',
  chocolate: '#d2691e',
  orchid: '#da70d6',
  plum: '#dda0dd',
  skyblue: '#87ceeb',
  steelblue: '#4682b4',
  royalblue: '#4169e1',
  slategray: '#708090',
  darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  dimgray: '#696969',
  darkred: '#8b0000',
  darkgreen: '#006400',
  darkblue: '#00008b',
  darkorange: '#ff8c00',
  forestgreen: '#228b22',
  seagreen: '#2e8b57',
  firebrick: '#b22222',
  hotpink: '#ff69b4',
  deeppink: '#ff1493',
  limegreen: '#32cd32',
  midnightblue: '#191970',
  sienna: '#a0522d',
  goldenrod: '#daa520',
  whitesmoke: '#f5f5f5',
  gainsboro: '#dcdcdc',
  mintcream: '#f5fffa',
  snow: '#fffafa',
};

/** Couleur SVG → `#rrggbbaa` ; null pour « none » ou une couleur illisible. */
function svgColor(raw: string | undefined, opacity = 1): string | null {
  if (!raw) return null;
  let v = raw.trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return null;
  if (v === 'currentcolor') v = '#000000';
  v = NAMED[v] ?? v;
  let rgba: { r: number; g: number; b: number; a: number } | null = null;
  const fn = /^rgba?\(([^)]*)\)$/.exec(v);
  if (fn) {
    const p = fn[1].split(/[\s,/]+/).filter(Boolean);
    const ch = (s: string) => (s.endsWith('%') ? (parseFloat(s) * 255) / 100 : parseFloat(s));
    rgba = {
      r: ch(p[0]),
      g: ch(p[1]),
      b: ch(p[2]),
      a: p[3] !== undefined ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : 1,
    };
  } else {
    const hex = normalizeHex(v);
    if (hex) rgba = parseColor(hex);
  }
  if (!rgba || [rgba.r, rgba.g, rgba.b].some((x) => Number.isNaN(x))) return null;
  return formatColor({ ...rgba, a: Math.max(0, Math.min(1, rgba.a * opacity)) });
}

/** Propriétés de présentation héritées ou lues sur un élément. */
type Style = Record<string, string>;

const INHERITED = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'visibility',
];
const OWN = ['opacity', 'display', 'transform'];

interface CssRule {
  selector: string;
  specificity: number;
  decls: Style;
}

function parseDecls(s: string): Style {
  const out: Style = {};
  for (const part of s.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    out[part.slice(0, i).trim().toLowerCase()] = part
      .slice(i + 1)
      .replace(/!important/, '')
      .trim();
  }
  return out;
}

function parseCss(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean))) {
    const decls = parseDecls(m[2]);
    for (const sel of m[1].split(',')) {
      const selector = sel.trim();
      // Sélecteurs simples uniquement : balise, .classe, #id, balise.classe.
      if (!/^[\w-]*(?:[.#][\w-]+)*$/.test(selector) || !selector) continue;
      const specificity =
        (selector.match(/#/g)?.length ?? 0) * 100 +
        (selector.match(/\./g)?.length ?? 0) * 10 +
        (/^[\w-]/.test(selector) ? 1 : 0);
      rules.push({ selector, specificity, decls });
    }
  }
  return rules.sort((a, b) => a.specificity - b.specificity);
}

function matches(el: XmlElement, selector: string): boolean {
  const tag = /^[\w-]+/.exec(selector)?.[0];
  if (tag && tag !== el.tag) return false;
  const classes = (el.attrs.class ?? '').split(/\s+/);
  for (const part of selector.match(/[.#][\w-]+/g) ?? []) {
    if (part[0] === '.' && !classes.includes(part.slice(1))) return false;
    if (part[0] === '#' && el.attrs.id !== part.slice(1)) return false;
  }
  return true;
}

// ————— Conversion —————

export interface SvgImport {
  /** Objets dans le repère du SVG (unités de son `viewBox` ramenées à sa taille). */
  nodes: SceneNode[];
  width: number;
  height: number;
  assets: Record<string, Asset>;
}

interface Ctx {
  ids: Map<string, XmlElement>;
  css: CssRule[];
  assets: Record<string, Asset>;
  depth: number;
}

function num(v: string | undefined, fallback = 0, ref = 100): number {
  if (v === undefined) return fallback;
  const f = parseFloat(v);
  if (Number.isNaN(f)) return fallback;
  if (v.trim().endsWith('%')) return (f * ref) / 100;
  // em ≈ 16 px, pt = 4/3 px, mm, cm, in.
  if (/pt$/.test(v)) return (f * 4) / 3;
  if (/mm$/.test(v)) return (f * 96) / 25.4;
  if (/cm$/.test(v)) return (f * 96) / 2.54;
  if (/in$/.test(v)) return f * 96;
  if (/em$/.test(v)) return f * 16;
  return f;
}

function computeStyle(el: XmlElement, parent: Style, ctx: Ctx): Style {
  const style: Style = {};
  for (const k of INHERITED) if (parent[k] !== undefined) style[k] = parent[k];
  for (const k of [...INHERITED, ...OWN]) if (el.attrs[k] !== undefined) style[k] = el.attrs[k];
  for (const r of ctx.css) if (matches(el, r.selector)) Object.assign(style, r.decls);
  if (el.attrs.style) Object.assign(style, parseDecls(el.attrs.style));
  for (const k of Object.keys(style)) if (style[k] === 'inherit') style[k] = parent[k] ?? '';
  return style;
}

function gradientPaint(
  el: XmlElement,
  ctx: Ctx,
  bbox: { x: number; y: number; width: number; height: number },
  opacity: number,
): Paint | null {
  // Les attributs peuvent venir d'un dégradé de référence (href).
  const chain: XmlElement[] = [];
  let cur: XmlElement | undefined = el;
  while (cur && chain.length < 8) {
    chain.push(cur);
    const href: string | undefined = cur.attrs.href ?? cur.attrs["xlink:href"];
    cur = href?.startsWith('#') ? ctx.ids.get(href.slice(1)) : undefined;
  }
  const attr = (k: string) => chain.find((c) => c.attrs[k] !== undefined)?.attrs[k];
  const stopsEl = chain.find((c) => c.children.some((s) => s.tag === 'stop'));
  const stops: GradientStop[] = (stopsEl?.children ?? [])
    .filter((s) => s.tag === 'stop')
    .map((s) => {
      const st = { ...s.attrs, ...(s.attrs.style ? parseDecls(s.attrs.style) : {}) };
      const op = st['stop-opacity'] !== undefined ? parseFloat(st['stop-opacity']) : 1;
      const offset = st.offset?.trim().endsWith('%')
        ? parseFloat(st.offset) / 100
        : parseFloat(st.offset ?? '0');
      return {
        offset: Math.max(0, Math.min(1, offset || 0)),
        color: svgColor(st['stop-color'] ?? 'black', op * opacity) ?? '#00000000',
      };
    });
  if (!stops.length) return null;
  if (stops.length === 1) return { type: 'solid', color: stops[0].color };
  const user = attr('gradientUnits') === 'userSpaceOnUse';
  // Coordonnées en fractions de la boîte de l'objet.
  const fx = (v: string | undefined, def: number) => {
    if (!user) return v?.trim().endsWith('%') ? parseFloat(v) / 100 : v !== undefined ? parseFloat(v) : def;
    return bbox.width ? (num(v, def * bbox.width + bbox.x) - bbox.x) / bbox.width : def;
  };
  const fy = (v: string | undefined, def: number) => {
    if (!user) return v?.trim().endsWith('%') ? parseFloat(v) / 100 : v !== undefined ? parseFloat(v) : def;
    return bbox.height ? (num(v, def * bbox.height + bbox.y) - bbox.y) / bbox.height : def;
  };
  if (el.tag === 'radialGradient') {
    const r = user
      ? num(attr('r'), 0.5 * Math.max(bbox.width, bbox.height)) / Math.max(bbox.width, bbox.height, 1)
      : fx(attr('r'), 0.5);
    return { type: 'radial', stops, cx: fx(attr('cx'), 0.5), cy: fy(attr('cy'), 0.5), r };
  }
  const x1 = fx(attr('x1'), 0),
    y1 = fy(attr('y1'), 0),
    x2 = fx(attr('x2'), 1),
    y2 = fy(attr('y2'), 0);
  const angle = (Math.atan2((y2 - y1) * (bbox.height || 1), (x2 - x1) * (bbox.width || 1)) * 180) / Math.PI;
  return { type: 'linear', stops, angle: Math.round(angle * 100) / 100 };
}

function paintOf(
  v: string | undefined,
  opacity: number,
  ctx: Ctx,
  bbox: { x: number; y: number; width: number; height: number },
): Paint {
  if (!v) return NONE;
  const url = /url\(\s*['"]?#([^'")]+)['"]?\s*\)/.exec(v);
  if (url) {
    const g = ctx.ids.get(url[1]);
    if (g && (g.tag === 'linearGradient' || g.tag === 'radialGradient'))
      return gradientPaint(g, ctx, bbox, opacity) ?? NONE;
    // Motif ou référence inconnue : couleur de repli éventuelle après l'URL.
    const fallback = v.slice(url.index + url[0].length).trim();
    const c = svgColor(fallback, opacity);
    return c ? { type: 'solid', color: c } : NONE;
  }
  const c = svgColor(v, opacity);
  return c ? { type: 'solid', color: c } : NONE;
}

function shapeCommands(el: XmlElement): PathCommand[] | null {
  const a = el.attrs;
  switch (el.tag) {
    case 'path':
      return a.d ? parseSvgPath(a.d) : null;
    case 'rect': {
      const w = num(a.width),
        h = num(a.height);
      if (w <= 0 || h <= 0) return null;
      const r = Math.max(num(a.rx, num(a.ry, 0)), 0);
      return roundRectPath(num(a.x), num(a.y), w, h, r);
    }
    case 'circle': {
      const r = num(a.r);
      return r > 0 ? ellipsePath(num(a.cx) - r, num(a.cy) - r, 2 * r, 2 * r) : null;
    }
    case 'ellipse': {
      const rx = num(a.rx),
        ry = num(a.ry, rx);
      return rx > 0 && ry > 0 ? ellipsePath(num(a.cx) - rx, num(a.cy) - ry, 2 * rx, 2 * ry) : null;
    }
    case 'line':
      return [
        { op: 'M', x: num(a.x1), y: num(a.y1) },
        { op: 'L', x: num(a.x2), y: num(a.y2) },
      ];
    case 'polyline':
    case 'polygon': {
      const v = (a.points?.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
      if (v.length < 4) return null;
      const cmds: PathCommand[] = [];
      for (let i = 0; i + 1 < v.length; i += 2) cmds.push({ op: i ? 'L' : 'M', x: v[i], y: v[i + 1] });
      if (el.tag === 'polygon') cmds.push({ op: 'Z' });
      return cmds;
    }
  }
  return null;
}

function convert(el: XmlElement, m: Matrix, parent: Style, ctx: Ctx): SceneNode[] {
  if (ctx.depth > 64) return [];
  const style = computeStyle(el, parent, ctx);
  if (style.display === 'none') return [];
  const mm = multiply(m, parseTransform(style.transform));
  const opacity = style.opacity !== undefined ? Math.max(0, Math.min(1, parseFloat(style.opacity))) : 1;
  const name = el.attrs.id ?? el.attrs['inkscape:label'] ?? '';
  const withOpacity = (n: SceneNode) => {
    if (opacity < 1) n.opacity = Math.round(opacity * 1000) / 1000;
    return n;
  };
  if (el.tag === 'g' || el.tag === 'a' || el.tag === 'svg' || el.tag === 'switch') {
    let mm2 = mm;
    if (el.tag === 'svg') {
      // SVG imbriqué : position et viewBox.
      mm2 = multiply(mm, viewBoxMatrix(el));
    }
    ctx.depth++;
    const kids = el.children.flatMap((c) => convert(c, mm2, style, ctx));
    ctx.depth--;
    if (!kids.length) return [];
    if (kids.length === 1 && opacity === 1) return kids;
    const g = createGroup(kids, name || 'Groupe');
    return [withOpacity(g)];
  }
  if (el.tag === 'use') {
    const href = el.attrs.href ?? el.attrs['xlink:href'];
    const target = href?.startsWith('#') ? ctx.ids.get(href.slice(1)) : undefined;
    if (!target || target === el) return [];
    const t = multiply(mm, [1, 0, 0, 1, num(el.attrs.x), num(el.attrs.y)]);
    ctx.depth++;
    const inner =
      target.tag === 'symbol'
        ? target.children.flatMap((c) => convert(c, multiply(t, viewBoxMatrix(target)), style, ctx))
        : convert(target, t, style, ctx);
    ctx.depth--;
    if (inner.length > 1 || opacity < 1) return [withOpacity(createGroup(inner, name || 'Groupe'))];
    return inner;
  }
  if (style.visibility === 'hidden') return [];
  if (el.tag === 'image') return imageNode(el, mm, ctx, name, opacity);
  if (el.tag === 'text') return textNode(el, mm, style, ctx, name, opacity);
  const local = shapeCommands(el);
  if (!local) return [];
  const cmds = mapCommands(local, (p) => apply(mm, p));
  const b = exactBounds(cmds);
  if (!b) return [];
  const scale = Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2])) || 1;
  const fillOpacity = style['fill-opacity'] !== undefined ? parseFloat(style['fill-opacity']) : 1;
  const strokeOpacity = style['stroke-opacity'] !== undefined ? parseFloat(style['stroke-opacity']) : 1;
  const fill = el.tag === 'line' ? NONE : paintOf(style.fill ?? 'black', fillOpacity, ctx, b);
  const stroke: Stroke = {
    paint: paintOf(style.stroke, strokeOpacity, ctx, b),
    width: Math.round(num(style['stroke-width'], 1) * scale * 1000) / 1000,
  };
  const cap = style['stroke-linecap'] as StrokeCap | undefined;
  const join = style['stroke-linejoin'] as StrokeJoin | undefined;
  stroke.cap = cap === 'round' || cap === 'square' ? cap : 'butt';
  stroke.join = join === 'round' || join === 'bevel' ? join : 'miter';
  const dash = style['stroke-dasharray'];
  if (dash && dash !== 'none' && stroke.width > 0) {
    const parts = (dash.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(
      (v) => (parseFloat(v) * scale) / stroke.width,
    );
    if (parts.length && parts.some((v) => v > 0)) stroke.dash = parts.map((v) => Math.round(v * 100) / 100);
  }
  const node = createPath({
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    d: pathToSvg(cmds),
    viewBox: b,
    fillRule: style['fill-rule'] === 'evenodd' ? 'evenodd' : undefined,
    name: name || nameOf(el.tag),
  });
  node.fill = fill;
  node.stroke = stroke;
  return [withOpacity(node)];
}

function nameOf(tag: string): string {
  return (
    (
      {
        rect: 'Rectangle',
        circle: 'Ellipse',
        ellipse: 'Ellipse',
        line: 'Ligne',
        polygon: 'Polygone',
      } as Record<string, string>
    )[tag] ?? 'Courbe'
  );
}

function viewBoxMatrix(el: XmlElement): Matrix {
  const x = num(el.attrs.x),
    y = num(el.attrs.y);
  const vb = (el.attrs.viewBox ?? '').split(/[\s,]+/).map(Number);
  if (vb.length !== 4 || vb.some((v) => Number.isNaN(v)) || !vb[2] || !vb[3]) return [1, 0, 0, 1, x, y];
  const w = num(el.attrs.width, vb[2]),
    h = num(el.attrs.height, vb[3]);
  const par = el.attrs.preserveAspectRatio ?? 'xMidYMid meet';
  let sx = w / vb[2],
    sy = h / vb[3];
  let tx = x,
    ty = y;
  if (!par.startsWith('none')) {
    const s = /slice/.test(par) ? Math.max(sx, sy) : Math.min(sx, sy);
    const ax = /xMin/.test(par) ? 0 : /xMax/.test(par) ? 1 : 0.5;
    const ay = /YMin/.test(par) ? 0 : /YMax/.test(par) ? 1 : 0.5;
    tx += (w - vb[2] * s) * ax;
    ty += (h - vb[3] * s) * ay;
    sx = sy = s;
  }
  return [sx, 0, 0, sy, tx - vb[0] * sx, ty - vb[1] * sy];
}

/** Rotation (degrés) et échelle d'une matrice sans cisaillement. */
function decompose(m: Matrix): { rotation: number; sx: number; sy: number } {
  const sx = Math.hypot(m[0], m[1]);
  const det = m[0] * m[3] - m[1] * m[2];
  const sy = sx ? det / sx : 0;
  return { rotation: (Math.atan2(m[1], m[0]) * 180) / Math.PI, sx, sy };
}

function imageNode(el: XmlElement, m: Matrix, ctx: Ctx, name: string, opacity: number): SceneNode[] {
  const href = el.attrs.href ?? el.attrs['xlink:href'];
  const data = /^data:(image\/[\w+.-]+)[;,]/.exec(href ?? '');
  if (!href || !data) return [];
  const w = num(el.attrs.width),
    h = num(el.attrs.height);
  if (w <= 0 || h <= 0) return [];
  const { rotation, sx, sy } = decompose(m);
  const c = apply(m, { x: num(el.attrs.x) + w / 2, y: num(el.attrs.y) + h / 2 });
  const width = Math.abs(w * sx),
    height = Math.abs(h * sy);
  const id = newId('img');
  ctx.assets[id] = { id, mime: data[1], width: Math.round(w), height: Math.round(h), data: href };
  const node = createImage({
    x: c.x - width / 2,
    y: c.y - height / 2,
    width,
    height,
    assetId: id,
    name: name || 'Image',
  });
  node.rotation = Math.round(rotation * 1000) / 1000;
  if (opacity < 1) node.opacity = opacity;
  return [node];
}

function textNode(
  el: XmlElement,
  m: Matrix,
  style: Style,
  ctx: Ctx,
  name: string,
  opacity: number,
): SceneNode[] {
  const collect = (e: XmlElement): string => e.text + e.children.map(collect).join('');
  const content = collect(el).replace(/\s+/g, ' ').trim();
  if (!content) return [];
  // Position : celle du texte, ou de son premier tspan.
  const first = el.children.find((c) => c.tag === 'tspan');
  const x = num(el.attrs.x ?? first?.attrs.x),
    y = num(el.attrs.y ?? first?.attrs.y);
  const { rotation, sx } = decompose(m);
  const size = num(style['font-size'], 16) * Math.abs(sx || 1);
  const anchor = style['text-anchor'];
  const base = apply(m, { x, y });
  const node = createText({
    x: base.x,
    y: base.y - size * 0.8,
    width: 10,
    height: size * 1.2,
    text: content,
    name: name || content.slice(0, 24),
  });
  node.style.fontSize = Math.round(size * 100) / 100;
  node.style.fontFamily =
    (style['font-family'] ?? 'Inter').split(',')[0].replace(/['"]/g, '').trim() || 'Inter';
  const weight = style['font-weight'];
  node.style.fontWeight = weight === 'bold' ? 700 : weight && /^\d+$/.test(weight) ? Number(weight) : 400;
  node.style.italic = /italic|oblique/.test(style['font-style'] ?? '');
  node.style.align = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
  const fo = style['fill-opacity'] !== undefined ? parseFloat(style['fill-opacity']) : 1;
  node.fill = paintOf(style.fill ?? 'black', fo, ctx, { x: base.x, y: base.y, width: 1, height: 1 });
  node.rotation = Math.round(rotation * 1000) / 1000;
  if (opacity < 1) node.opacity = opacity;
  // La largeur est recalculée par l'éditeur ; le point d'ancrage est noté pour le centrage.
  if (node.style.align !== 'left') node.x -= node.style.align === 'center' ? 5 : 10;
  return [node];
}

/** Lit un fichier SVG. Renvoie null si ce n'est pas un SVG lisible. */
export function importSvg(src: string): SvgImport | null {
  const root = parseXml(src);
  if (!root) return null;
  const ids = new Map<string, XmlElement>();
  let css = '';
  const index = (e: XmlElement) => {
    if (e.attrs.id) ids.set(e.attrs.id, e);
    if (e.tag === 'style') css += e.text + e.children.map((c) => c.text).join('');
    e.children.forEach(index);
  };
  index(root);
  const ctx: Ctx = { ids, css: parseCss(css), assets: {}, depth: 0 };
  const vb = (root.attrs.viewBox ?? '').split(/[\s,]+/).map(Number);
  const hasVb = vb.length === 4 && vb.every((v) => !Number.isNaN(v)) && vb[2] > 0 && vb[3] > 0;
  const width = num(root.attrs.width, hasVb ? vb[2] : 300);
  const height = num(root.attrs.height, hasVb ? vb[3] : 150);
  const m = viewBoxMatrix({
    ...root,
    attrs: { ...root.attrs, x: '0', y: '0', width: String(width), height: String(height) },
  });
  const skip = new Set([
    'defs',
    'style',
    'title',
    'desc',
    'metadata',
    'symbol',
    'clipPath',
    'mask',
    'linearGradient',
    'radialGradient',
    'pattern',
    'filter',
    'marker',
  ]);
  const rootStyle = computeStyle(root, {}, ctx);
  const nodes = root.children.filter((c) => !skip.has(c.tag)).flatMap((c) => convert(c, m, rootStyle, ctx));
  return { nodes, width, height, assets: ctx.assets };
}
