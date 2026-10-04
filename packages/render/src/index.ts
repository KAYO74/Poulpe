import {
  baselineY,
  cssFont,
  layoutText,
  lineOffset,
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
  const layout = layoutText(node, measure);
  const st = node.style;
  const fill = canvasPaint(ctx, node.fill, node.width, node.height);
  const stroke =
    node.stroke.paint.type !== 'none' && node.stroke.width > 0
      ? canvasPaint(ctx, node.stroke.paint, node.width, node.height)
      : null;
  ctx.font = cssFont(st);
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  layout.lines.forEach((line, i) => {
    if (!line.text) return;
    const y = baselineY(layout, st, i);
    const isLast = i === layout.lines.length - 1;
    const justify = st.align === 'justify' && !node.autoWidth && !isLast && /\s/.test(line.text);
    const x0 = lineOffset(layout, line, st.align);
    // Découpage en morceaux : mots pour la justification, lettres pour l'interlettrage.
    const pieces: { text: string; x: number }[] = [];
    if (justify) {
      const words = line.text.split(/\s+/);
      const wordsW = words.reduce((s, w) => s + measure(w, ctx.font) + st.letterSpacing * w.length, 0);
      const gap = (layout.width - wordsW) / (words.length - 1);
      let x = 0;
      for (const w of words) {
        pieces.push({ text: w, x });
        x += measure(w, ctx.font) + st.letterSpacing * w.length + gap;
      }
    } else pieces.push({ text: line.text, x: x0 });
    for (const piece of pieces) {
      const draw = (text: string, x: number) => {
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fillText(text, x, y);
        }
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = node.stroke.width;
          ctx.strokeText(text, x, y);
        }
      };
      if (st.letterSpacing) {
        let x = piece.x;
        for (const ch of piece.text) {
          draw(ch, x);
          x += measure(ch, ctx.font) + st.letterSpacing;
        }
      } else draw(piece.text, piece.x);
    }
    if (st.underline || st.strike) {
      const lineW = justify ? layout.width : line.width;
      const x = justify ? 0 : x0;
      const thickness = Math.max(1, st.fontSize / 15);
      ctx.fillStyle = fill ?? stroke ?? '#000';
      if (st.underline) ctx.fillRect(x, y + st.fontSize * 0.1, lineW, thickness);
      if (st.strike) ctx.fillRect(x, y - st.fontSize * 0.3, lineW, thickness);
    }
  });
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
      ctx.clip(toPath2D(shapePath(mask)));
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
    if (img) ctx.drawImage(img, 0, 0, w, h);
  } else if (node.type === 'text') {
    drawText(ctx, node, measure);
  } else {
    const path = toPath2D(shapePath(node));
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
