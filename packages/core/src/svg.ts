import { opaque, alphaOf } from './color';
import { activeEffects, effectMargin } from './effects';
import { linearGradientPoints, nodeBounds, pathToSvg, radialGradientRadius, shapePath } from './geometry';
import { approximateMeasure, charX, layoutText, type CharStyle, type MeasureText } from './text';
import type { Artboard, Paint, PoulpeDocument, SceneNode, Stroke } from './types';
import { arrowPaths, dashPattern, layoutTextOnPath, strokeCap, strokeJoin } from './vector';

export interface SvgExportOptions {
  measureText?: MeasureText;
  /**
   * Remplace le SVG d'un objet (par exemple une image de l'objet avec ses effets, pour le PDF qui
   * ne sait pas lire les filtres). Renvoie null pour garder l'export normal.
   */
  override?: (node: SceneNode) => string | null;
  /** Inclure le fond du plan de travail (sinon fond transparent). */
  background?: boolean;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => String(+v.toFixed(3));

class Defs {
  private items: string[] = [];
  private count = 0;
  id(prefix: string) {
    return `${prefix}${++this.count}`;
  }
  add(s: string) {
    this.items.push(s);
  }
  toString() {
    return this.items.length ? `<defs>${this.items.join('')}</defs>` : '';
  }
}

function colorAttrs(attr: 'fill' | 'stroke', color: string): string {
  const a = alphaOf(color);
  return `${attr}="${opaque(color)}"${a < 1 ? ` ${attr}-opacity="${n(a)}"` : ''}`;
}

function stops(paint: Extract<Paint, { stops: unknown }>): string {
  return [...paint.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => {
      const a = alphaOf(s.color);
      return `<stop offset="${n(s.offset)}" stop-color="${opaque(s.color)}"${a < 1 ? ` stop-opacity="${n(a)}"` : ''}/>`;
    })
    .join('');
}

/** Attribut de peinture ; les dégradés sont exprimés dans le repère local de l'objet (0..w, 0..h). */
function paintAttr(attr: 'fill' | 'stroke', paint: Paint, w: number, h: number, defs: Defs): string {
  switch (paint.type) {
    case 'none':
      return `${attr}="none"`;
    case 'solid':
      return colorAttrs(attr, paint.color);
    case 'linear': {
      const id = defs.id('lg');
      const [a, b] = linearGradientPoints(paint.angle, w, h);
      defs.add(
        `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}">${stops(paint)}</linearGradient>`,
      );
      return `${attr}="url(#${id})"`;
    }
    case 'radial': {
      const id = defs.id('rg');
      defs.add(
        `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(paint.cx * w)}" cy="${n(paint.cy * h)}" r="${n(radialGradientRadius(paint, w, h))}">${stops(paint)}</radialGradient>`,
      );
      return `${attr}="url(#${id})"`;
    }
  }
}

function strokeAttrs(stroke: Stroke, w: number, h: number, defs: Defs): string {
  if (stroke.paint.type === 'none' || stroke.width <= 0) return '';
  const join = strokeJoin(stroke);
  const dash = dashPattern(stroke);
  return (
    ` ${paintAttr('stroke', stroke.paint, w, h, defs)} stroke-width="${n(stroke.width)}" stroke-linejoin="${join}" stroke-linecap="${strokeCap(stroke)}"` +
    (join === 'miter' ? ' stroke-miterlimit="10"' : '') +
    (dash.length ? ` stroke-dasharray="${dash.map(n).join(' ')}"` : '')
  );
}

/** Filtre SVG des effets d'un objet ; la zone du filtre est donnée dans le repère du monde. */
function effectsFilter(node: SceneNode, defs: Defs): string | null {
  const effects = activeEffects(node);
  if (!effects.length) return null;
  const id = defs.id('fx');
  const b = nodeBounds(node);
  const m = effectMargin(effects) + 2;
  const sd = (r: number) => n(Math.max(0, r) / 2);
  const flood = (c: string) => `<feFlood flood-color="${opaque(c)}" flood-opacity="${n(alphaOf(c))}"/>`;
  let body = '';
  const merge: string[] = [];
  let content = 'SourceGraphic';
  let k = 0;
  for (const e of effects) {
    const r = `e${++k}`;
    if (e.type === 'dropShadow' || e.type === 'outerGlow') {
      const dx = e.type === 'dropShadow' ? e.x : 0,
        dy = e.type === 'dropShadow' ? e.y : 0;
      body += `<feGaussianBlur in="SourceAlpha" stdDeviation="${sd(e.blur)}"/><feOffset dx="${n(dx)}" dy="${n(dy)}" result="${r}o"/>${flood(e.color)}<feComposite in2="${r}o" operator="in" result="${r}"/>`;
      merge.push(r);
    } else if (e.type === 'blur') {
      body += `<feGaussianBlur in="SourceGraphic" stdDeviation="${sd(e.radius)}" result="${r}"/>`;
      content = r;
    }
  }
  merge.push(content);
  for (const e of effects) {
    const r = `e${++k}`;
    if (e.type === 'innerShadow' || e.type === 'innerGlow') {
      const dx = e.type === 'innerShadow' ? e.x : 0,
        dy = e.type === 'innerShadow' ? e.y : 0;
      body += `<feComponentTransfer in="SourceAlpha" result="${r}i"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer><feGaussianBlur in="${r}i" stdDeviation="${sd(e.blur)}"/><feOffset dx="${n(dx)}" dy="${n(dy)}" result="${r}o"/>${flood(e.color)}<feComposite in2="${r}o" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="${r}"/>`;
      merge.push(r);
    }
  }
  defs.add(
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="${n(b.x - m)}" y="${n(b.y - m)}" width="${n(b.width + 2 * m)}" height="${n(b.height + 2 * m)}" color-interpolation-filters="sRGB">${body}<feMerge>${merge.map((r) => `<feMergeNode in="${r}"/>`).join('')}</feMerge></filter>`,
  );
  return id;
}

function transformAttr(node: SceneNode): string {
  const t = `translate(${n(node.x)} ${n(node.y)})`;
  if (!node.rotation) return t;
  return `${t} rotate(${n(node.rotation)} ${n(node.width / 2)} ${n(node.height / 2)})`;
}

function commonAttrs(node: SceneNode): string {
  let s = '';
  if (node.opacity < 1) s += ` opacity="${n(node.opacity)}"`;
  if (node.blendMode !== 'normal') s += ` style="mix-blend-mode:${node.blendMode}"`;
  return s;
}

interface Ctx {
  doc: PoulpeDocument;
  defs: Defs;
  measure: MeasureText;
  override?: (node: SceneNode) => string | null;
}

function nodeToSvg(node: SceneNode, ctx: Ctx): string {
  if (!node.visible) return '';
  const replaced = ctx.override?.(node);
  if (replaced != null) return replaced;
  let body = nodeContentToSvg(node, ctx);
  const fx = body ? effectsFilter(node, ctx.defs) : null;
  // Le filtre est posé sur un groupe sans transformation : décalages dans le repère du monde.
  if (fx) body = `<g filter="url(#${fx})">${body}</g>`;
  const mask = node.mask?.enabled ? ctx.doc.assets[node.mask.assetId] : undefined;
  if (body && mask) {
    // Masque de calque : seule l'opacité de l'image du masque compte.
    const id = ctx.defs.id('mask');
    ctx.defs.add(
      `<mask id="${id}" maskUnits="userSpaceOnUse" style="mask-type:alpha"><image transform="${transformAttr(node)}" width="${n(node.width)}" height="${n(node.height)}" preserveAspectRatio="none" href="${mask.data}"/></mask>`,
    );
    body = `<g mask="url(#${id})">${body}</g>`;
  }
  return body;
}

function nodeContentToSvg(node: SceneNode, ctx: Ctx): string {
  const { doc, defs, measure } = ctx;
  const label = ` data-name="${esc(node.name)}"`;
  if (node.type === 'group') {
    const kids = node.children;
    if (node.clip && kids.length > 1 && kids[0].type !== 'group') {
      const mask = kids[0];
      const id = defs.id('clip');
      defs.add(
        `<clipPath id="${id}"><path transform="${transformAttr(mask)}" d="${pathToSvg(shapePath(mask))}"/></clipPath>`,
      );
      return `<g${label}${commonAttrs(node)}>${nodeToSvg(mask, ctx)}<g clip-path="url(#${id})">${kids
        .slice(1)
        .map((c) => nodeToSvg(c, ctx))
        .join('')}</g></g>`;
    }
    return `<g${label}${commonAttrs(node)}>${kids.map((c) => nodeToSvg(c, ctx)).join('')}</g>`;
  }
  // Les réglages ne s'expriment pas en SVG : l'export les met en image (voir `override`).
  if (node.type === 'adjustment') return '';
  const w = node.width,
    h = node.height;
  const open = `<g${label} transform="${transformAttr(node)}"${commonAttrs(node)}>`;
  if (node.type === 'image') {
    const asset = doc.assets[node.assetId];
    if (!asset) return '';
    const c = node.crop;
    if (!c || (c.x === 0 && c.y === 0 && c.width === 1 && c.height === 1))
      return `${open}<image width="${n(w)}" height="${n(h)}" preserveAspectRatio="none" href="${asset.data}"/></g>`;
    // Image recadrée : l'image entière, découpée par la boîte de l'objet.
    const fw = w / c.width,
      fh = h / c.height;
    const id = defs.id('crop');
    defs.add(`<clipPath id="${id}"><rect width="${n(w)}" height="${n(h)}"/></clipPath>`);
    return `${open}<g clip-path="url(#${id})"><image x="${n(-c.x * fw)}" y="${n(-c.y * fh)}" width="${n(fw)}" height="${n(fh)}" preserveAspectRatio="none" href="${asset.data}"/></g></g>`;
  }
  if (node.type === 'text') {
    const layout = layoutText(node, measure);
    const st = node.style;
    const deco = (c: { underline: boolean; strike: boolean }) =>
      [c.underline && 'underline', c.strike && 'line-through'].filter(Boolean).join(' ');
    const fontAttrs = (c: CharStyle, ref?: CharStyle) => {
      let a = '';
      if (!ref || c.fontFamily !== ref.fontFamily) a += ` font-family="${esc(c.fontFamily)}, sans-serif"`;
      if (!ref || c.fontSize !== ref.fontSize) a += ` font-size="${n(c.fontSize)}"`;
      if (!ref || c.fontWeight !== ref.fontWeight) a += ` font-weight="${c.fontWeight}"`;
      if (c.italic !== (ref?.italic ?? false)) a += ` font-style="${c.italic ? 'italic' : 'normal'}"`;
      if (c.letterSpacing !== (ref?.letterSpacing ?? 0)) a += ` letter-spacing="${n(c.letterSpacing)}"`;
      const dc = deco(c);
      if (dc !== (ref ? deco(ref) : '')) a += ` text-decoration="${dc || 'none'}"`;
      if (c.color) a += ` ${colorAttrs('fill', c.color)}`;
      return a;
    };
    const attrs =
      fontAttrs(st) + ` ${paintAttr('fill', node.fill, w, h, defs)}` + strokeAttrs(node.stroke, w, h, defs);
    if (node.path) {
      // Texte sur tracé : chaque caractère est posé et tourné à sa place.
      const glyphs = layoutTextOnPath(node, measure)
        .map(
          (g) =>
            `<text x="${n(-g.width / 2)}" y="0" transform="translate(${n(g.x)} ${n(g.y)}) rotate(${n((g.angle * 180) / Math.PI)})"${fontAttrs(g.style, st)}>${esc(g.char)}</text>`,
        )
        .join('');
      return `${open}<g xml:space="preserve"${attrs}>${glyphs}</g></g>`;
    }
    let spans = '';
    for (const line of layout.lines) {
      for (const seg of line.segments) {
        // Texte justifié : chaque mot est placé ; sinon un morceau par style.
        const re = line.gap ? /\s+|\S+/g : /[\s\S]+/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(seg.text))) {
          if (line.gap && /^\s+$/.test(m[0])) continue;
          const x = charX(line, seg.start + m.index, measure);
          spans += `<tspan x="${n(x)}" y="${n(line.baseline)}"${fontAttrs(seg.style, st)}>${esc(m[0])}</tspan>`;
        }
      }
    }
    return `${open}<text xml:space="preserve"${attrs}>${spans}</text></g>`;
  }
  const cmds = shapePath(node);
  const d = pathToSvg(cmds);
  const rule = node.type === 'path' && node.fillRule === 'evenodd' ? ' fill-rule="evenodd"' : '';
  const arrows = arrowPaths(cmds, node.stroke);
  const heads = arrows.length
    ? `<path d="${pathToSvg(arrows)}" ${paintAttr('fill', node.stroke.paint, w, h, defs)}/>`
    : '';
  return `${open}<path d="${d}"${rule} ${paintAttr('fill', node.type === 'line' ? { type: 'none' } : node.fill, w, h, defs)}${strokeAttrs(node.stroke, w, h, defs)}/>${heads}</g>`;
}

/** Exporte un plan de travail en SVG autonome (images incluses). */
export function artboardToSvg(doc: PoulpeDocument, artboard: Artboard, opts: SvgExportOptions = {}): string {
  const measure = opts.measureText ?? approximateMeasure;
  const defs = new Defs();
  const bg =
    opts.background !== false && artboard.background.type !== 'none'
      ? `<rect width="${n(artboard.width)}" height="${n(artboard.height)}" ${paintAttr('fill', artboard.background, artboard.width, artboard.height, defs)}/>`
      : '';
  const ctx: Ctx = { doc, defs, measure, override: opts.override };
  const body = artboard.children.map((c) => nodeToSvg(c, ctx)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(artboard.width)}" height="${n(artboard.height)}" viewBox="0 0 ${n(artboard.width)} ${n(artboard.height)}">` +
    `<title>${esc(artboard.name)}</title>${defs}${bg}<g transform="translate(${n(-artboard.x)} ${n(-artboard.y)})">${body}</g></svg>`
  );
}
