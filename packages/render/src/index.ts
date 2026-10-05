import {
  charX,
  layoutText,
  linearGradientPoints,
  radialGradientRadius,
  rgbaToCss,
  shapePath,
  type Artboard,
  type BlendMode,
  type MeasureText,
  type Paint,
  type PathCommand,
  type PoulpeDocument,
  type SceneNode,
  type TextLayout,
  type TextNode,
} from '@poulpe/core';

/*
 * Rendu du document sur un canevas 2D.
 *
 * C'est la première implémentation de l'interface de rendu. Tout le dessin passe par ce module,
 * ce qui permet de lui substituer un rendu CanvasKit (Skia / WebGL) sans toucher au reste.
 */

export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Cache des images du document, décodées à partir de leurs données. */
export class ImageCache {
  private images = new Map<string, HTMLImageElement>();
  constructor(private onLoad: () => void = () => {}) {}

  get(doc: PoulpeDocument, assetId: string): HTMLImageElement | null {
    const asset = doc.assets[assetId];
    if (!asset) return null;
    let img = this.images.get(assetId);
    if (!img || img.dataset.src !== String(asset.data.length)) {
      img = new Image();
      img.dataset.src = String(asset.data.length);
      img.onload = () => this.onLoad();
      img.src = asset.data;
      this.images.set(assetId, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  /** Attend que toutes les images du document soient décodées (avant un export). */
  async ready(doc: PoulpeDocument): Promise<void> {
    await Promise.all(
      Object.keys(doc.assets).map((id) => {
        this.get(doc, id);
        const img = this.images.get(id);
        return img && !img.complete ? img.decode().catch(() => {}) : Promise.resolve();
      }),
    );
  }
}

let measureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

/** Mesure du texte par le navigateur, partagée par le rendu, l'éditeur et l'export SVG. */
export const measureText: MeasureText = (text, font) => {
  if (!measureCtx) {
    measureCtx =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(1, 1).getContext('2d')!
        : document.createElement('canvas').getContext('2d')!;
  }
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
};

/*
 * Caches : les documents sont immuables, un objet inchangé garde son identité d'une image à
 * l'autre. Sa mise en page de texte et son tracé sont donc calculés une seule fois. Les objets
 * modifiables (brouillons immer) ne sont jamais mis en cache.
 */
let layoutCache = new WeakMap<TextNode, { measure: MeasureText; layout: TextLayout }>();
const pathCache = new WeakMap<SceneNode, Path2D>();

/** Mise en page d'un texte, mémorisée tant que l'objet ne change pas. */
export function cachedLayout(node: TextNode, measure: MeasureText = measureText): TextLayout {
  if (!Object.isFrozen(node)) return layoutText(node, measure);
  const hit = layoutCache.get(node);
  if (hit && hit.measure === measure) return hit.layout;
  const layout = layoutText(node, measure);
  layoutCache.set(node, { measure, layout });
  return layout;
}

/** À appeler quand les mesures changent (une police vient de se charger). */
export function clearLayoutCache(): void {
  layoutCache = new WeakMap();
}

/** Tracé d'un objet dans son repère local, mémorisé tant que l'objet ne change pas. */
export function nodePath(node: SceneNode): Path2D {
  if (!Object.isFrozen(node)) return toPath2D(shapePath(node));
  let p = pathCache.get(node);
  if (!p) {
    p = toPath2D(shapePath(node));
    pathCache.set(node, p);
  }
  return p;
}

export function toPath2D(cmds: PathCommand[]): Path2D {
  const p = new Path2D();
  for (const c of cmds) {
    if (c.op === 'M') p.moveTo(c.x, c.y);
    else if (c.op === 'L') p.lineTo(c.x, c.y);
    else if (c.op === 'C') p.bezierCurveTo(c.x1, c.y1, c.x2, c.y2, c.x, c.y);
    else p.closePath();
  }
  return p;
}

export function compositeOp(mode: BlendMode): GlobalCompositeOperation {
  return mode === 'normal' ? 'source-over' : mode;
}

/** Style de peinture dans le repère local d'un objet de taille w × h. */
export function canvasPaint(ctx: Ctx, paint: Paint, w: number, h: number): string | CanvasGradient | null {
  switch (paint.type) {
    case 'none':
      return null;
    case 'solid':
      return rgbaToCss(paint.color);
    case 'linear': {
      const [a, b] = linearGradientPoints(paint.angle, w, h);
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      for (const s of paint.stops) g.addColorStop(Math.min(1, Math.max(0, s.offset)), rgbaToCss(s.color));
      return g;
    }
    case 'radial': {
      const g = ctx.createRadialGradient(
        paint.cx * w,
        paint.cy * h,
        0,
        paint.cx * w,
        paint.cy * h,
        Math.max(0.001, radialGradientRadius(paint, w, h)),
      );
      for (const s of paint.stops) g.addColorStop(Math.min(1, Math.max(0, s.offset)), rgbaToCss(s.color));
      return g;
    }
  }
}

export interface RenderOptions {
  images: ImageCache;
  measure?: MeasureText;
  /** Objets à ne pas dessiner (par ex. le texte en cours d'édition). */
  hidden?: Set<string>;
}

function applyNodeTransform(ctx: Ctx, node: SceneNode) {
  ctx.translate(node.x + node.width / 2, node.y + node.height / 2);
  if (node.rotation) ctx.rotate((node.rotation * Math.PI) / 180);
  ctx.translate(-node.width / 2, -node.height / 2);
}

function drawText(ctx: Ctx, node: TextNode, measure: MeasureText) {
  const layout = cachedLayout(node, measure);
  const fill = canvasPaint(ctx, node.fill, node.width, node.height);
  const stroke =
    node.stroke.paint.type !== 'none' && node.stroke.width > 0
      ? canvasPaint(ctx, node.stroke.paint, node.width, node.height)
      : null;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  for (const line of layout.lines) {
    const y = line.baseline;
    for (const seg of line.segments) {
      const st = seg.style;
      const segFill = st.color ? rgbaToCss(st.color) : fill;
      ctx.font = seg.font;
      const draw = (text: string, x: number) => {
        if (segFill) {
          ctx.fillStyle = segFill;
          ctx.fillText(text, x, y);
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = node.stroke.width;
          ctx.strokeText(text, x, y);
        }
      };
      // Morceaux : mots pour la justification, lettres pour l'interlettrage.
      const re = line.gap || st.letterSpacing ? (st.letterSpacing ? /[\s\S]/gu : /\s+|\S+/g) : /[\s\S]+/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(seg.text))) {
        if (/^\s+$/.test(m[0])) continue;
        draw(m[0], charX(line, seg.start + m.index, measure));
      }
      if (st.underline || st.strike) {
        const x0 = charX(line, seg.start, measure);
        const x1 = charX(line, seg.end, measure);
        const thickness = Math.max(1, st.fontSize / 15);
        ctx.fillStyle = segFill ?? stroke ?? '#000';
        if (st.underline) ctx.fillRect(x0, y + st.fontSize * 0.1, x1 - x0, thickness);
        if (st.strike) ctx.fillRect(x0, y - st.fontSize * 0.3, x1 - x0, thickness);
      }
    }
  }
}

export function drawNode(ctx: Ctx, doc: PoulpeDocument, node: SceneNode, opts: RenderOptions): void {
  if (!node.visible || opts.hidden?.has(node.id)) return;
  const measure = opts.measure ?? measureText;
  ctx.save();
  ctx.globalAlpha *= node.opacity;
  ctx.globalCompositeOperation = compositeOp(node.blendMode);
  if (node.type === 'group') {
    const kids = node.children;
    if (node.clip && kids.length > 1 && kids[0].type !== 'group') {
      const mask = kids[0];
      drawNode(ctx, doc, mask, opts);
      ctx.save();
      ctx.translate(mask.x + mask.width / 2, mask.y + mask.height / 2);
      ctx.rotate((mask.rotation * Math.PI) / 180);
      ctx.translate(-mask.width / 2, -mask.height / 2);
      ctx.clip(nodePath(mask));
      ctx.setTransform(ctx.getTransform().multiply(inverseLocal(mask)));
      for (const c of kids.slice(1)) drawNode(ctx, doc, c, opts);
      ctx.restore();
    } else {
      for (const c of kids) drawNode(ctx, doc, c, opts);
    }
    ctx.restore();
    return;
  }
  applyNodeTransform(ctx, node);
  const w = node.width,
    h = node.height;
  if (node.type === 'image') {
    const img = opts.images.get(doc, node.assetId);
    if (img) {
      const c = node.crop;
      if (c) {
        const iw = img.naturalWidth,
          ih = img.naturalHeight;
        ctx.drawImage(img, c.x * iw, c.y * ih, c.width * iw, c.height * ih, 0, 0, w, h);
      } else ctx.drawImage(img, 0, 0, w, h);
    }
  } else if (node.type === 'text') {
    drawText(ctx, node, measure);
  } else {
    const path = nodePath(node);
    if (node.type !== 'line') {
      const fill = canvasPaint(ctx, node.fill, w, h);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill(path);
      }
    }
    if (node.stroke.paint.type !== 'none' && node.stroke.width > 0) {
      const stroke = canvasPaint(ctx, node.stroke.paint, w, h);
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = node.stroke.width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke(path);
      }
    }
  }
  ctx.restore();
}

/** Inverse de la transformation locale d'un objet (pour revenir au repère du monde après un écrêtage). */
function inverseLocal(node: SceneNode): DOMMatrix {
  return new DOMMatrix()
    .translate(node.x + node.width / 2, node.y + node.height / 2)
    .rotate(node.rotation)
    .translate(-node.width / 2, -node.height / 2)
    .inverse();
}

/** Dessine le fond et le contenu d'un plan de travail, dans le repère du monde. */
export function drawArtboard(
  ctx: Ctx,
  doc: PoulpeDocument,
  ab: Artboard,
  opts: RenderOptions & { background?: boolean; clip?: boolean },
): void {
  ctx.save();
  if (opts.clip !== false) {
    ctx.beginPath();
    ctx.rect(ab.x, ab.y, ab.width, ab.height);
    ctx.clip();
  }
  if (opts.background !== false) {
    ctx.save();
    ctx.translate(ab.x, ab.y);
    const bg = canvasPaint(ctx, ab.background, ab.width, ab.height);
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, ab.width, ab.height);
    }
    ctx.restore();
  }
  for (const n of ab.children) drawNode(ctx, doc, n, opts);
  ctx.restore();
}

export interface RasterOptions {
  scale?: number;
  type?: 'image/png' | 'image/jpeg';
  /** Qualité JPEG, de 0 à 1. */
  quality?: number;
  background?: boolean;
}

/** Rendu d'un plan de travail en image (PNG ou JPEG). */
export async function rasterizeArtboard(
  doc: PoulpeDocument,
  ab: Artboard,
  images: ImageCache,
  opts: RasterOptions = {},
): Promise<Blob> {
  await images.ready(doc);
  const scale = opts.scale ?? 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(ab.width * scale));
  canvas.height = Math.max(1, Math.round(ab.height * scale));
  const ctx = canvas.getContext('2d')!;
  if (opts.type === 'image/jpeg') {
    // Le JPEG n'a pas de transparence : fond blanc sous le plan de travail.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(scale, scale);
  ctx.translate(-ab.x, -ab.y);
  drawArtboard(ctx, doc, ab, { images, background: opts.background });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('export impossible'))),
      opts.type ?? 'image/png',
      opts.quality ?? 0.92,
    ),
  );
}
