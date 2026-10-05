import {
  activeEffects,
  chainHead,
  flowText,
  masterOf,
  needsFlow,
  pageFields,
  type PageFields,
  type TextFlow,
  arrowPaths,
  charX,
  dashPattern,
  effectMargin,
  layoutTextOnPath,
  nodeBounds,
  strokeCap,
  strokeJoin,
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
  type Stroke,
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

let flowCache = new WeakMap<PoulpeDocument, Map<string, TextFlow>>();

/**
 * Répartition d'un texte de mise en page (cadre, chaîne de cadres liés ou champs), mémorisée tant
 * que le document ne change pas. `fields` null : champs laissés tels quels (texte en édition).
 */
export function cachedFlow(
  doc: PoulpeDocument,
  id: string,
  fields: PageFields | null,
  measure: MeasureText = measureText,
): TextFlow {
  const head = chainHead(doc, id);
  const key = `${head?.id ?? id}|${fields ? `${fields.page}/${fields.pages}` : ''}`;
  if (!Object.isFrozen(doc) || measure !== measureText) return flowText(doc, id, measure, fields);
  let map = flowCache.get(doc);
  if (!map) flowCache.set(doc, (map = new Map()));
  let flow = map.get(key);
  if (!flow) map.set(key, (flow = flowText(doc, id, measure, fields)));
  return flow;
}

/**
 * Mise en page d'un texte telle qu'affichée : seul, ou sa part d'une chaîne de cadres liés.
 * Null : le cadre n'affiche rien (tout le texte tient dans les cadres précédents).
 */
export function textLayoutIn(
  doc: PoulpeDocument,
  node: TextNode,
  opts: { measure?: MeasureText; fields?: PageFields | null; editingId?: string | null } = {},
): TextLayout | null {
  const measure = opts.measure ?? measureText;
  if (!needsFlow(doc, node)) return cachedLayout(node, measure);
  const raw = !!opts.editingId && chainHead(doc, node.id)?.id === opts.editingId;
  const flow = cachedFlow(doc, node.id, raw ? null : (opts.fields ?? null), measure);
  return flow.parts.find((p) => p.node.id === node.id)?.layout ?? null;
}

/** À appeler quand les mesures changent (une police vient de se charger). */
export function clearLayoutCache(): void {
  layoutCache = new WeakMap();
  flowCache = new WeakMap();
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
  /** Numéro de page et nombre de pages, pour les champs des textes. */
  fields?: PageFields | null;
  /** Texte en cours d'édition : ses champs restent affichés tels quels. */
  editingId?: string | null;
}

function applyNodeTransform(ctx: Ctx, node: SceneNode) {
  ctx.translate(node.x + node.width / 2, node.y + node.height / 2);
  if (node.rotation) ctx.rotate((node.rotation * Math.PI) / 180);
  ctx.translate(-node.width / 2, -node.height / 2);
}

function drawText(ctx: Ctx, doc: PoulpeDocument, node: TextNode, opts: RenderOptions) {
  const measure = opts.measure ?? measureText;
  const fill = canvasPaint(ctx, node.fill, node.width, node.height);
  const stroke =
    node.stroke.paint.type !== 'none' && node.stroke.width > 0
      ? canvasPaint(ctx, node.stroke.paint, node.width, node.height)
      : null;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  if (node.path) {
    // Texte sur tracé : chaque caractère est posé et tourné à sa place sur la courbe.
    for (const g of layoutTextOnPath(node, measure)) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.font = g.font;
      const f = g.style.color ? rgbaToCss(g.style.color) : fill;
      if (f) {
        ctx.fillStyle = f;
        ctx.fillText(g.char, -g.width / 2, 0);
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = node.stroke.width;
        ctx.strokeText(g.char, -g.width / 2, 0);
      }
      ctx.restore();
    }
    return;
  }
  const layout = textLayoutIn(doc, node, opts);
  if (!layout) return;
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
  if (node.effects?.length) {
    const effects = activeEffects(node);
    if (effects.length && drawWithEffects(ctx, doc, node, opts, effects)) return;
  }
  ctx.save();
  ctx.globalAlpha *= node.opacity;
  ctx.globalCompositeOperation = compositeOp(node.blendMode);
  drawContent(ctx, doc, node, opts);
  ctx.restore();
}

/** Applique le style d'un contour (épaisseur, extrémités, jonctions, pointillés). */
export function applyStrokeStyle(ctx: Ctx, stroke: Stroke): void {
  ctx.lineWidth = stroke.width;
  ctx.lineJoin = strokeJoin(stroke);
  ctx.lineCap = strokeCap(stroke);
  ctx.miterLimit = 10;
  ctx.setLineDash(dashPattern(stroke));
}

const arrowCache = new WeakMap<SceneNode, Path2D | null>();

/** Flèches d'un tracé ouvert, mémorisées tant que l'objet ne change pas. */
function arrowPath(node: Exclude<SceneNode, { type: 'group' | 'image' | 'text' }>): Path2D | null {
  if (
    (!node.stroke.start || node.stroke.start === 'none') &&
    (!node.stroke.end || node.stroke.end === 'none')
  )
    return null;
  if (Object.isFrozen(node) && arrowCache.has(node)) return arrowCache.get(node)!;
  const cmds = arrowPaths(shapePath(node), node.stroke);
  const p = cmds.length ? toPath2D(cmds) : null;
  if (Object.isFrozen(node)) arrowCache.set(node, p);
  return p;
}

/** Dessine un objet sans son opacité, son mode de fusion ni ses effets. */
function drawContent(ctx: Ctx, doc: PoulpeDocument, node: SceneNode, opts: RenderOptions): void {
  const measure = opts.measure ?? measureText;
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
    return;
  }
  ctx.save();
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
    drawText(ctx, doc, node, opts);
  } else {
    const path = nodePath(node);
    if (node.type !== 'line') {
      const fill = canvasPaint(ctx, node.fill, w, h);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill(path, node.type === 'path' && node.fillRule === 'evenodd' ? 'evenodd' : 'nonzero');
      }
    }
    if (node.stroke.paint.type !== 'none' && node.stroke.width > 0) {
      const stroke = canvasPaint(ctx, node.stroke.paint, w, h);
      if (stroke) {
        ctx.strokeStyle = stroke;
        applyStrokeStyle(ctx, node.stroke);
        ctx.stroke(path);
        const heads = arrowPath(node);
        if (heads) {
          ctx.fillStyle = stroke;
          ctx.fill(heads);
        }
      }
    }
  }
  ctx.restore();
}

// ————— Effets —————

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type AnyCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(w: number, h: number): { canvas: AnyCanvas; ctx: AnyCtx } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, ctx: canvas.getContext('2d')! };
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d')! };
}

let filterSupport: boolean | null = null;

/** Le canevas sait-il flouter (`ctx.filter`) ? Ce n'est pas le cas de Safari. */
function canFilter(): boolean {
  if (filterSupport === null) {
    const { ctx } = makeCanvas(1, 1);
    ctx.filter = 'blur(2px)';
    filterSupport = ctx.filter === 'blur(2px)';
  }
  return filterSupport;
}

/** Copie floutée d'un calque (écart type `sigma` en pixels). */
function blurred(src: AnyCanvas, sigma: number): AnyCanvas {
  const { canvas, ctx } = makeCanvas(src.width, src.height);
  if (sigma <= 0.01) {
    ctx.drawImage(src, 0, 0);
    return canvas;
  }
  if (canFilter()) {
    ctx.filter = `blur(${sigma}px)`;
    ctx.drawImage(src, 0, 0);
    return canvas;
  }
  // Repli : réduction puis agrandissement lissé, ce qui approche un flou.
  const k = Math.max(1, sigma / 1.5);
  const small = makeCanvas(Math.max(1, Math.round(src.width / k)), Math.max(1, Math.round(src.height / k)));
  small.ctx.imageSmoothingQuality = 'high';
  small.ctx.drawImage(src, 0, 0, small.canvas.width, small.canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small.canvas, 0, 0, src.width, src.height);
  return canvas;
}

const FAR = 100000;

/** Ombre seule d'un calque (sans le calque lui-même), ajoutée sur `out`. */
function castShadow(
  out: AnyCtx,
  src: AnyCanvas,
  color: string,
  dx: number,
  dy: number,
  blur: number,
  op: GlobalCompositeOperation = 'source-over',
) {
  out.save();
  out.globalCompositeOperation = op;
  out.shadowColor = rgbaToCss(color);
  out.shadowBlur = blur;
  // Le calque est dessiné très loin, seule son ombre retombe à sa place.
  out.shadowOffsetX = dx + FAR;
  out.shadowOffsetY = dy;
  out.drawImage(src, -FAR, 0);
  out.restore();
}

/**
 * Dessine un objet avec ses effets : l'objet est rendu dans un calque à part (en pixels de
 * l'écran ou de l'export), puis ombres, lueurs et flou sont composés autour de lui.
 * Renvoie false si le calque n'a pas pu être créé (on dessine alors sans effets).
 */
function drawWithEffects(
  ctx: Ctx,
  doc: PoulpeDocument,
  node: SceneNode,
  opts: RenderOptions,
  effects: ReturnType<typeof activeEffects>,
): boolean {
  const m = ctx.getTransform();
  const scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  const b = nodeBounds(node);
  const margin = effectMargin(effects) + 2;
  const pts = [
    [b.x - margin, b.y - margin],
    [b.x + b.width + margin, b.y - margin],
    [b.x + b.width + margin, b.y + b.height + margin],
    [b.x - margin, b.y + b.height + margin],
  ].map(([x, y]) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }));
  let x0 = Math.floor(Math.min(...pts.map((p) => p.x)));
  let y0 = Math.floor(Math.min(...pts.map((p) => p.y)));
  let x1 = Math.ceil(Math.max(...pts.map((p) => p.x)));
  let y1 = Math.ceil(Math.max(...pts.map((p) => p.y)));
  // Inutile de rendre ce qui sort de la zone visible (plus la portée des effets).
  const reach = Math.ceil(margin * scale);
  x0 = Math.max(x0, -reach);
  y0 = Math.max(y0, -reach);
  x1 = Math.min(x1, ctx.canvas.width + reach);
  y1 = Math.min(y1, ctx.canvas.height + reach);
  const w = x1 - x0,
    h = y1 - y0;
  if (w <= 0 || h <= 0) return true;
  if (w * h > 64e6) return false;
  const layer = makeCanvas(w, h);
  layer.ctx.setTransform(m.a, m.b, m.c, m.d, m.e - x0, m.f - y0);
  drawContent(layer.ctx, doc, node, opts);

  const out = makeCanvas(w, h);
  const o = out.ctx;
  for (const e of effects) {
    if (e.type === 'dropShadow')
      castShadow(o, layer.canvas, e.color, e.x * scale, e.y * scale, e.blur * scale);
    else if (e.type === 'outerGlow') castShadow(o, layer.canvas, e.color, 0, 0, e.blur * scale);
  }
  const blur = effects.find((e) => e.type === 'blur');
  o.drawImage(
    blur && blur.type === 'blur' ? blurred(layer.canvas, (blur.radius * scale) / 2) : layer.canvas,
    0,
    0,
  );
  const inner = effects.filter((e) => e.type === 'innerShadow' || e.type === 'innerGlow');
  if (inner.length) {
    // Inverse du calque : ce qui est hors de l'objet, dont l'ombre tombe à l'intérieur.
    const inv = makeCanvas(w, h);
    inv.ctx.fillStyle = '#000';
    inv.ctx.fillRect(0, 0, w, h);
    inv.ctx.globalCompositeOperation = 'destination-out';
    inv.ctx.drawImage(layer.canvas, 0, 0);
    for (const e of inner) {
      if (e.type !== 'innerShadow' && e.type !== 'innerGlow') continue;
      const tmp = makeCanvas(w, h);
      const dx = e.type === 'innerShadow' ? e.x * scale : 0,
        dy = e.type === 'innerShadow' ? e.y * scale : 0;
      castShadow(tmp.ctx, inv.canvas, e.color, dx, dy, e.blur * scale);
      tmp.ctx.globalCompositeOperation = 'destination-in';
      tmp.ctx.drawImage(layer.canvas, 0, 0);
      o.drawImage(tmp.canvas, 0, 0);
    }
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= node.opacity;
  ctx.globalCompositeOperation = compositeOp(node.blendMode);
  ctx.drawImage(out.canvas, x0, y0);
  ctx.restore();
  return true;
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
  const pageOpts = { ...opts, fields: pageFields(doc, ab) };
  // Les objets de la page maître passent sous ceux de la page, au même endroit relatif.
  const master = masterOf(doc, ab);
  if (master) {
    ctx.save();
    ctx.translate(ab.x - master.x, ab.y - master.y);
    for (const n of master.children) drawNode(ctx, doc, n, pageOpts);
    ctx.restore();
  }
  for (const n of ab.children) drawNode(ctx, doc, n, pageOpts);
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
