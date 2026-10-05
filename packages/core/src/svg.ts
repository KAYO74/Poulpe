import { opaque, alphaOf } from './color';
import { linearGradientPoints, pathToSvg, radialGradientRadius, shapePath } from './geometry';
import { approximateMeasure, charX, layoutText, type CharStyle, type MeasureText } from './text';
import type { Artboard, Paint, PoulpeDocument, SceneNode, Stroke } from './types';

export interface SvgExportOptions {
  measureText?: MeasureText;
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
  return ` ${paintAttr('stroke', stroke.paint, w, h, defs)} stroke-width="${n(stroke.width)}" stroke-linejoin="round" stroke-linecap="round"`;
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

function nodeToSvg(node: SceneNode, doc: PoulpeDocument, defs: Defs, measure: MeasureText): string {
  if (!node.visible) return '';
  const label = ` data-name="${esc(node.name)}"`;
  if (node.type === 'group') {
    const kids = node.children;
    if (node.clip && kids.length > 1 && kids[0].type !== 'group') {
      const mask = kids[0];
      const id = defs.id('clip');
      defs.add(
        `<clipPath id="${id}"><path transform="${transformAttr(mask)}" d="${pathToSvg(shapePath(mask))}"/></clipPath>`,
      );
      return `<g${label}${commonAttrs(node)}>${nodeToSvg(mask, doc, defs, measure)}<g clip-path="url(#${id})">${kids
        .slice(1)
        .map((c) => nodeToSvg(c, doc, defs, measure))
        .join('')}</g></g>`;
    }
    return `<g${label}${commonAttrs(node)}>${kids.map((c) => nodeToSvg(c, doc, defs, measure)).join('')}</g>`;
  }
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
  const d = pathToSvg(shapePath(node));
  return `${open}<path d="${d}" ${paintAttr('fill', node.type === 'line' ? { type: 'none' } : node.fill, w, h, defs)}${strokeAttrs(node.stroke, w, h, defs)}/></g>`;
}

/** Exporte un plan de travail en SVG autonome (images incluses). */
export function artboardToSvg(doc: PoulpeDocument, artboard: Artboard, opts: SvgExportOptions = {}): string {
  const measure = opts.measureText ?? approximateMeasure;
  const defs = new Defs();
  const bg =
    opts.background !== false && artboard.background.type !== 'none'
      ? `<rect width="${n(artboard.width)}" height="${n(artboard.height)}" ${paintAttr('fill', artboard.background, artboard.width, artboard.height, defs)}/>`
      : '';
  const body = artboard.children.map((c) => nodeToSvg(c, doc, defs, measure)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${n(artboard.width)}" height="${n(artboard.height)}" viewBox="0 0 ${n(artboard.width)} ${n(artboard.height)}">` +
    `<title>${esc(artboard.name)}</title>${defs}${bg}<g transform="translate(${n(-artboard.x)} ${n(-artboard.y)})">${body}</g></svg>`
  );
}
