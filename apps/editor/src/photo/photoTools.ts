import {
  applyAdjustment,
  findNode,
  floodMask,
  gaussianBlurred,
  luma,
  parseColor,
  type ImageNode,
  type Pixels,
  type SceneNode,
  type Vec,
} from '@poulpe/core';
import { setLiveBitmap } from '@poulpe/render';
import type { CanvasController } from '../canvas/controller';
import { t } from '../i18n';
import {
  brushSettings,
  editor,
  isBrushTool,
  setBrush,
  toast,
  ui,
  type BrushSettings,
  type SelectionMode,
  type ToolId,
} from '../store';
import { inpaintAsync } from './inpaintClient';
import { addMask } from './photoActions';
import {
  commitBitmap,
  copyDrawable,
  docToMask,
  docToPixels,
  imageAt,
  images,
  makeCanvas,
  maskSize,
  newPixelLayer,
  selectedImage,
} from './pixels';
import { getSelection, selectShape, selectSimilar, selectionIn, selectionOutline } from './selection';

/*
 * Outils de la Persona Photo : sélections (rectangle, ellipse, lasso, baguette magique),
 * pinceau, gomme, pot de peinture, tampon de duplication, densité − et +, flou et netteté au
 * pinceau, et gomme magique.
 *
 * Un coup de pinceau travaille sur une copie des pixels du calque (ou de son masque) : la copie
 * est affichée à la place de l'image pendant le geste, puis enregistrée dans le document en une
 * seule étape d'historique au relâchement.
 */

const SELECT_TOOLS: ToolId[] = ['marqueeRect', 'marqueeEllipse', 'lasso', 'magicWand'];
/** Outils qui peignent une couleur : sans calque de pixels choisi, ils en créent un. */
const CREATES_LAYER: ToolId[] = ['brush', 'fill'];
/** Outils qui recopient une version transformée des pixels sous le pinceau. */
const SOURCE_TOOLS: ToolId[] = ['clone', 'dodge', 'burn', 'blurBrush', 'sharpenBrush'];

export function isPhotoTool(tool: ToolId): boolean {
  return SELECT_TOOLS.includes(tool) || isBrushTool(tool) || tool === 'fill';
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Pixels d'origine transformés à la demande, par tuiles (densité, flou, netteté au pinceau). */
class LazySource {
  readonly canvas: HTMLCanvasElement;
  private done: Uint8Array;
  private cols: number;
  private static TILE = 256;
  constructor(
    private base: HTMLCanvasElement,
    private compute: (px: Pixels) => void,
    private margin: number,
  ) {
    this.canvas = makeCanvas(base.width, base.height);
    this.cols = Math.ceil(base.width / LazySource.TILE);
    this.done = new Uint8Array(this.cols * Math.ceil(base.height / LazySource.TILE));
  }

  ensure(r: Rect): void {
    const T = LazySource.TILE;
    const bctx = this.base.getContext('2d', { willReadFrequently: true })!;
    const sctx = this.canvas.getContext('2d')!;
    for (let ty = Math.floor(r.y0 / T); ty <= Math.floor((r.y1 - 1) / T); ty++)
      for (let tx = Math.floor(r.x0 / T); tx <= Math.floor((r.x1 - 1) / T); tx++) {
        const i = ty * this.cols + tx;
        if (tx < 0 || ty < 0 || tx >= this.cols || i >= this.done.length || this.done[i]) continue;
        this.done[i] = 1;
        const m = Math.ceil(this.margin);
        const x0 = Math.max(0, tx * T - m),
          y0 = Math.max(0, ty * T - m);
        const x1 = Math.min(this.base.width, (tx + 1) * T + m),
          y1 = Math.min(this.base.height, (ty + 1) * T + m);
        const img = bctx.getImageData(x0, y0, x1 - x0, y1 - y0);
        this.compute({ data: img.data, width: img.width, height: img.height });
        const ix = tx * T - x0,
          iy = ty * T - y0;
        sctx.putImageData(
          img,
          x0,
          y0,
          ix,
          iy,
          Math.min(T, this.base.width - tx * T),
          Math.min(T, this.base.height - ty * T),
        );
      }
  }
}

interface Stroke {
  tool: ToolId;
  nodeId: string;
  which: 'pixels' | 'mask';
  /** Image affichée à la place pendant le geste. */
  assetId: string;
  toPx: DOMMatrix;
  /** Pixels de la cible par pixel du document. */
  pxScale: number;
  base: HTMLCanvasElement;
  work: HTMLCanvasElement;
  /** Couverture accumulée du coup de pinceau. */
  buf: HTMLCanvasElement;
  /** Aperçu rouge de la gomme magique. */
  tint: HTMLCanvasElement | null;
  sel: HTMLCanvasElement | null;
  source: LazySource | HTMLCanvasElement | null;
  stamp: HTMLCanvasElement;
  settings: BrushSettings;
  /** Valeur peinte dans un masque, de 0 (cacher) à 1 (montrer). */
  maskValue: number;
  last: Vec;
  /** Distance restant à parcourir avant la prochaine touche. */
  carry: number;
  /** Le calque vient d'être créé pour ce coup de pinceau. */
  pending: boolean;
}

function luminance(color: string): number {
  const c = parseColor(color);
  return luma(c.r, c.g, c.b) / 255;
}

/** Empreinte ronde du pinceau, au rayon donné, bord plus ou moins doux. */
function makeStamp(radius: number, hardness: number, color: string): HTMLCanvasElement {
  const r = Math.max(0.5, radius);
  const size = Math.ceil(r * 2) + 2;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, r);
  const h = Math.min(0.99, Math.max(0, hardness / 100));
  const col = parseColor(color);
  const rgba = (a: number) => `rgba(${col.r},${col.g},${col.b},${a})`;
  g.addColorStop(0, rgba(1));
  g.addColorStop(h, rgba(1));
  // Bord doux : décroissance en douceur (courbe en cloche approchée).
  g.addColorStop(h + (1 - h) * 0.5, rgba(0.5));
  g.addColorStop(1, rgba(0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export class PhotoTools {
  private stroke: Stroke | null = null;
  private marquee: { start: Vec; current: Vec; mode: SelectionMode; shape: 'rect' | 'ellipse' } | null = null;
  private lasso: { points: Vec[]; mode: SelectionMode } | null = null;
  private pointer: Vec | null = null;
  private cloneSource: Vec | null = null;
  /** Décalage du tampon (source − destination, en pixels du document), gardé d'un coup à l'autre. */
  private cloneOffset: Vec | null = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private unsub: () => void;
  private tmp = makeCanvas(64, 64);
  private tmp2 = makeCanvas(64, 64);

  constructor(private readonly c: CanvasController) {
    // Les fourmis de la sélection bougent : on redessine régulièrement tant qu'il y en a.
    this.unsub = ui.subscribe(() => this.updateTimer());
  }

  dispose(): void {
    this.unsub();
    clearInterval(this.timer);
  }

  private updateTimer() {
    const need = ui.get().hasPixelSelection || !!this.lasso || !!ui.get().busy;
    if (need && !this.timer) this.timer = setInterval(() => this.c.requestDraw(), 140);
    else if (!need && this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  get busy(): boolean {
    return !!(this.stroke || this.marquee || this.lasso);
  }

  private mode(e: PointerEvent | MouseEvent): SelectionMode {
    if (e.shiftKey && e.altKey) return 'intersect';
    if (e.shiftKey) return 'add';
    if (e.altKey) return 'subtract';
    return ui.get().selectionMode;
  }

  // ————— Pointeur —————

  pointerDown(e: PointerEvent, p: Vec, s: Vec): boolean {
    const tool = ui.get().tool;
    if (!isPhotoTool(tool) || ui.get().persona !== 'photo') return false;
    this.pointer = s;
    if (ui.get().busy) return true;
    if (tool === 'marqueeRect' || tool === 'marqueeEllipse') {
      this.marquee = {
        start: p,
        current: p,
        mode: this.mode(e),
        shape: tool === 'marqueeRect' ? 'rect' : 'ellipse',
      };
      return true;
    }
    if (tool === 'lasso') {
      this.lasso = { points: [p], mode: this.mode(e) };
      this.updateTimer();
      return true;
    }
    if (tool === 'magicWand') {
      selectSimilar(p, images(), this.mode(e));
      return true;
    }
    if (tool === 'clone' && e.altKey) {
      this.cloneSource = p;
      this.cloneOffset = null;
      toast(t('photo.cloneSourceSet'));
      return true;
    }
    if (tool === 'fill') {
      this.fillAt(p);
      return true;
    }
    this.beginStroke(tool, p, e);
    return true;
  }

  pointerMove(e: PointerEvent, p: Vec, s: Vec): boolean {
    const tool = ui.get().tool;
    const active = isPhotoTool(tool) && ui.get().persona === 'photo';
    if (active || this.pointer) {
      this.pointer = active ? s : null;
      if (isBrushTool(tool)) this.c.requestDraw();
    }
    if (this.marquee) {
      let cur = p;
      if (e.shiftKey && this.marquee.mode !== 'add') {
        // Maj pendant le tracé : carré ou cercle.
        const d = Math.max(Math.abs(p.x - this.marquee.start.x), Math.abs(p.y - this.marquee.start.y));
        cur = {
          x: this.marquee.start.x + Math.sign(p.x - this.marquee.start.x || 1) * d,
          y: this.marquee.start.y + Math.sign(p.y - this.marquee.start.y || 1) * d,
        };
      }
      this.marquee.current = cur;
      this.c.requestDraw();
      return true;
    }
    if (this.lasso) {
      const last = this.lasso.points[this.lasso.points.length - 1];
      const z = ui.get().view.zoom;
      if (Math.hypot(p.x - last.x, p.y - last.y) * z > 2) this.lasso.points.push(p);
      this.c.requestDraw();
      return true;
    }
    if (this.stroke && !this.stroke.pending) {
      const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
      const rect = this.c.canvas.getBoundingClientRect();
      const pts = events.length
        ? events.map((ev) => ({
            p: this.c.toWorld(ev.clientX - rect.left, ev.clientY - rect.top),
            pressure: ev.pressure,
            pen: ev.pointerType === 'pen',
          }))
        : [{ p, pressure: e.pressure, pen: e.pointerType === 'pen' }];
      for (const q of pts) this.strokeTo(q.p, q.pen ? q.pressure : 1);
      this.recompose();
      return true;
    }
    return false;
  }

  pointerUp(): boolean {
    if (this.marquee) {
      const m = this.marquee;
      this.marquee = null;
      selectShape(m.shape, [m.start, m.current], m.mode);
      this.c.requestDraw();
      return true;
    }
    if (this.lasso) {
      const l = this.lasso;
      this.lasso = null;
      if (l.points.length > 2) selectShape('polygon', l.points, l.mode);
      else if (l.mode === 'replace') selectShape('rect', [l.points[0], l.points[0]], 'replace');
      this.updateTimer();
      this.c.requestDraw();
      return true;
    }
    if (this.stroke && !this.stroke.pending) {
      void this.endStroke();
      return true;
    }
    return false;
  }

  pointerCancel(): void {
    this.marquee = null;
    this.lasso = null;
    if (this.stroke && !this.stroke.pending) {
      setLiveBitmap(this.stroke.assetId, null);
      this.stroke = null;
    }
    this.c.requestDraw();
  }

  pointerLeave(): void {
    this.pointer = null;
    this.c.requestDraw();
  }

  /** Raccourcis de la Persona Photo : [ et ] changent la taille du pinceau, X échange les couleurs. */
  key(e: KeyboardEvent): boolean {
    if (ui.get().persona !== 'photo') return false;
    const tool = ui.get().tool;
    if ((e.key === '[' || e.key === ']') && isBrushTool(tool)) {
      const s = brushSettings(tool).size;
      const step = s < 10 ? 1 : s < 50 ? 5 : s < 200 ? 10 : 50;
      setBrush({ size: Math.max(1, Math.min(2000, e.key === ']' ? s + step : s - step)) });
      this.c.requestDraw();
      return true;
    }
    if (e.key === 'x' || e.key === 'X') {
      ui.set((s) => ({ brushColor: s.brushColor2, brushColor2: s.brushColor }));
      return true;
    }
    if (e.key === 'd' || e.key === 'D') {
      ui.set({ brushColor: '#000000', brushColor2: '#ffffff' });
      return true;
    }
    if (e.key === 'Escape' && (this.lasso || this.marquee)) {
      this.lasso = null;
      this.marquee = null;
      this.c.requestDraw();
      return true;
    }
    return false;
  }

  // ————— Cible —————

  /**
   * Calque visé : l'image sélectionnée, ou celle sous le pointeur. Pour le pinceau et le pot de
   * peinture, un calque de pixels vide est créé s'il n'y en a pas.
   */
  private target(tool: ToolId, p: Vec): { node: SceneNode; which: 'pixels' | 'mask' } | null {
    const maskId = ui.get().maskEditId;
    if (maskId) {
      let n = findNode(editor.doc, maskId)?.node;
      if (n && n.visible && !n.locked && n.type !== 'group') {
        if (!n.mask) {
          addMask(n.id);
          n = findNode(editor.doc, maskId)?.node;
        }
        if (n) return { node: n, which: 'mask' };
      }
      ui.set({ maskEditId: null });
    }
    let node: ImageNode | null = selectedImage();
    if (!node && !CREATES_LAYER.includes(tool)) {
      node = imageAt(p);
      if (node) editor.select([node.id]);
    }
    if (!node && CREATES_LAYER.includes(tool)) {
      const id = newPixelLayer(p);
      const n = id ? findNode(editor.doc, id)?.node : null;
      if (n?.type === 'image') node = n;
    }
    if (!node) {
      toast(t('photo.needPixelLayer'));
      return null;
    }
    return { node, which: 'pixels' };
  }

  /** Pixels de départ de la cible, son repère et l'image à remplacer pendant le geste. */
  private targetPixels(node: SceneNode, which: 'pixels' | 'mask') {
    const doc = editor.doc;
    if (which === 'pixels' && node.type === 'image') {
      const img = images().get(doc, node.assetId);
      if (!img) return null;
      const base = copyDrawable(img);
      const toPx = docToPixels(node, base.width, base.height);
      return { base, toPx, assetId: node.assetId };
    }
    let base: HTMLCanvasElement;
    if (node.mask) {
      const img = images().get(doc, node.mask.assetId);
      if (!img) return null;
      base = copyDrawable(img);
    } else {
      // Pas encore de masque : on part d'un masque blanc (tout visible).
      const size = maskSize(node);
      base = makeCanvas(size.width, size.height);
      const ctx = base.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, base.width, base.height);
    }
    return {
      base,
      toPx: docToMask(node, base.width, base.height),
      assetId: node.mask?.assetId ?? `pending-mask-${node.id}`,
    };
  }

  // ————— Pinceaux —————

  private beginStroke(tool: ToolId, p: Vec, e: PointerEvent) {
    const target = this.target(tool, p);
    if (!target) return;
    const { node, which } = target;
    const px = this.targetPixels(node, which);
    if (!px) return;
    const settings = brushSettings(tool);
    const { base, toPx, assetId } = px;
    const pxScale = Math.sqrt(Math.abs(toPx.a * toPx.d - toPx.b * toPx.c)) || 1;
    const w = base.width,
      h = base.height;
    const work = copyDrawable(base);
    const buf = makeCanvas(w, h);
    const sel = selectionIn(w, h, toPx);
    const color = ui.get().brushColor;
    const maskValue = tool === 'eraser' ? 0 : luminance(color);
    const radius = (settings.size / 2) * pxScale;
    const stampColor = which === 'pixels' && tool === 'brush' ? color : '#ffffff';
    const stamp = makeStamp(radius, tool === 'magicEraser' ? 100 : settings.hardness, stampColor);

    let source: Stroke['source'] = null;
    if (which === 'pixels' && SOURCE_TOOLS.includes(tool)) {
      if (tool === 'clone') {
        if (!this.cloneSource) {
          toast(t('photo.cloneNeedSource'));
          return;
        }
        if (!this.cloneOffset)
          this.cloneOffset = { x: this.cloneSource.x - p.x, y: this.cloneSource.y - p.y };
        const a = toPx.transformPoint(new DOMPoint(p.x, p.y));
        const b = toPx.transformPoint(new DOMPoint(p.x + this.cloneOffset.x, p.y + this.cloneOffset.y));
        const s = makeCanvas(w, h);
        s.getContext('2d')!.drawImage(base, a.x - b.x, a.y - b.y);
        source = s;
      } else if (tool === 'dodge' || tool === 'burn') {
        const ev = tool === 'dodge' ? 0.7 : -0.7;
        source = new LazySource(
          base,
          (q) => applyAdjustment(q, { kind: 'exposure', exposure: ev, offset: 0, gamma: 1 }),
          0,
        );
      } else if (tool === 'blurBrush') {
        const sigma = 3 * pxScale;
        source = new LazySource(base, (q) => q.data.set(gaussianBlurred(q, sigma)), sigma * 3);
      } else {
        source = new LazySource(
          base,
          (q) =>
            applyAdjustment(
              q,
              { kind: 'unsharpMask', amount: 150, radius: 1.5, threshold: 0 },
              { scale: pxScale },
            ),
          6 * pxScale,
        );
      }
    } else if (SOURCE_TOOLS.includes(tool)) {
      // Sur un masque, ces outils n'ont pas de sens : on peint simplement.
    }

    const start = toPx.transformPoint(new DOMPoint(p.x, p.y));
    this.stroke = {
      tool,
      nodeId: node.id,
      which,
      assetId,
      toPx,
      pxScale,
      base,
      work,
      buf,
      tint: tool === 'magicEraser' ? makeCanvas(w, h) : null,
      sel,
      source,
      stamp,
      settings,
      maskValue,
      last: { x: start.x, y: start.y },
      carry: 0,
      pending: false,
    };
    if (tool !== 'magicEraser') setLiveBitmap(assetId, work);
    this.dab(start.x, start.y, e.pointerType === 'pen' ? e.pressure : 1);
    this.recompose();
  }

  private dirty: Rect | null = null;

  private dab(x: number, y: number, pressure: number) {
    const s = this.stroke!;
    const r = (s.settings.size / 2) * s.pxScale * Math.max(0.05, pressure);
    const ctx = s.buf.getContext('2d')!;
    ctx.globalAlpha = s.tool === 'magicEraser' ? 1 : Math.max(0.01, s.settings.flow / 100);
    const k = r / ((s.stamp.width - 2) / 2);
    const size = s.stamp.width * k;
    ctx.drawImage(s.stamp, x - size / 2, y - size / 2, size, size);
    const pad = size / 2 + 2;
    const d = this.dirty;
    const rect = { x0: x - pad, y0: y - pad, x1: x + pad, y1: y + pad };
    this.dirty = d
      ? {
          x0: Math.min(d.x0, rect.x0),
          y0: Math.min(d.y0, rect.y0),
          x1: Math.max(d.x1, rect.x1),
          y1: Math.max(d.y1, rect.y1),
        }
      : rect;
  }

  private strokeTo(p: Vec, pressure: number) {
    const s = this.stroke!;
    const q = s.toPx.transformPoint(new DOMPoint(p.x, p.y));
    const dx = q.x - s.last.x,
      dy = q.y - s.last.y;
    const dist = Math.hypot(dx, dy);
    const spacing = Math.max(0.75, s.settings.size * s.pxScale * 0.1);
    let tpos = spacing - s.carry;
    while (tpos <= dist) {
      const k = tpos / dist;
      this.dab(s.last.x + dx * k, s.last.y + dy * k, pressure);
      tpos += spacing;
    }
    s.carry = dist - (tpos - spacing);
    s.last = { x: q.x, y: q.y };
  }

  private scratch(w: number, h: number, which: 1 | 2): HTMLCanvasElement {
    const c = which === 1 ? this.tmp : this.tmp2;
    if (c.width < w || c.height < h) {
      c.width = Math.max(c.width, w);
      c.height = Math.max(c.height, h);
    }
    return c;
  }

  /** Recompose la zone touchée : pixels d'origine + coup de pinceau, limité à la sélection. */
  private recompose() {
    const s = this.stroke;
    const d = this.dirty;
    this.dirty = null;
    if (!s || !d) return;
    const W = s.base.width,
      H = s.base.height;
    const x0 = Math.max(0, Math.floor(d.x0)),
      y0 = Math.max(0, Math.floor(d.y0));
    const x1 = Math.min(W, Math.ceil(d.x1)),
      y1 = Math.min(H, Math.ceil(d.y1));
    const w = x1 - x0,
      h = y1 - y0;
    if (w <= 0 || h <= 0) return;

    if (s.tool === 'magicEraser') {
      // La gomme magique ne touche pas encore aux pixels : on montre la zone en rouge.
      const tc = s.tint!.getContext('2d')!;
      // « source-in » touche toute la toile : on le limite à la zone pour garder le reste du trait.
      tc.save();
      tc.beginPath();
      tc.rect(x0, y0, w, h);
      tc.clip();
      tc.clearRect(x0, y0, w, h);
      tc.drawImage(s.buf, x0, y0, w, h, x0, y0, w, h);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = 'rgba(255, 60, 90, 0.55)';
      tc.fillRect(x0, y0, w, h);
      tc.restore();
      this.c.requestDraw();
      return;
    }

    // Couverture du coup de pinceau dans la zone, limitée à la sélection.
    const cov = this.scratch(w, h, 1);
    const cc = cov.getContext('2d')!;
    cc.globalCompositeOperation = 'copy';
    cc.drawImage(s.buf, x0, y0, w, h, 0, 0, w, h);
    if (s.sel) {
      cc.globalCompositeOperation = 'destination-in';
      cc.drawImage(s.sel, x0, y0, w, h, 0, 0, w, h);
    }
    cc.globalCompositeOperation = 'source-over';

    const wc = s.work.getContext('2d')!;
    wc.save();
    // (« copy » effacerait toute la toile hors de la zone : on vide seulement la zone.)
    wc.clearRect(x0, y0, w, h);
    wc.drawImage(s.base, x0, y0, w, h, x0, y0, w, h);
    const opacity = Math.max(0, Math.min(1, s.settings.opacity / 100));
    if (s.which === 'mask') {
      // Masque : on va vers la valeur peinte (blanc = visible, noir = caché).
      wc.globalAlpha = opacity;
      wc.globalCompositeOperation = 'destination-out';
      wc.drawImage(cov, 0, 0, w, h, x0, y0, w, h);
      if (s.maskValue > 0) {
        wc.globalAlpha = opacity * s.maskValue;
        wc.globalCompositeOperation = 'lighter';
        wc.drawImage(cov, 0, 0, w, h, x0, y0, w, h);
      }
    } else if (s.tool === 'eraser') {
      wc.globalAlpha = opacity;
      wc.globalCompositeOperation = 'destination-out';
      wc.drawImage(cov, 0, 0, w, h, x0, y0, w, h);
    } else if (s.source) {
      const src =
        s.source instanceof LazySource ? (s.source.ensure({ x0, y0, x1, y1 }), s.source.canvas) : s.source;
      const t2 = this.scratch(w, h, 2);
      const tc = t2.getContext('2d')!;
      tc.globalCompositeOperation = 'copy';
      tc.drawImage(src, x0, y0, w, h, 0, 0, w, h);
      tc.globalCompositeOperation = 'destination-in';
      tc.drawImage(cov, 0, 0, w, h, 0, 0, w, h);
      tc.globalCompositeOperation = 'source-over';
      wc.globalAlpha = opacity;
      // Les retouches ne changent pas l'opacité du calque.
      wc.globalCompositeOperation = s.tool === 'clone' ? 'source-over' : 'source-atop';
      wc.drawImage(t2, 0, 0, w, h, x0, y0, w, h);
    } else {
      wc.globalAlpha = opacity;
      wc.drawImage(cov, 0, 0, w, h, x0, y0, w, h);
    }
    wc.restore();
    setLiveBitmap(s.assetId, s.work);
    this.c.requestDraw();
  }

  private async endStroke() {
    const s = this.stroke!;
    if (s.tool === 'magicEraser') {
      s.pending = true;
      try {
        await this.runInpaint(s.nodeId, s.base, s.buf, 16);
      } finally {
        this.stroke = null;
        this.c.requestDraw();
      }
      return;
    }
    this.stroke = null;
    const labels: Partial<Record<ToolId, string>> = {
      brush: 'history.brush',
      eraser: 'history.erase',
      clone: 'history.clone',
      dodge: 'history.dodge',
      burn: 'history.burn',
      blurBrush: 'history.blurBrush',
      sharpenBrush: 'history.sharpenBrush',
    };
    commitBitmap(
      s.nodeId,
      s.which,
      s.work,
      s.which === 'mask' ? 'history.maskPaint' : (labels[s.tool] ?? 'history.brush'),
    );
    setLiveBitmap(s.assetId, null);
  }

  /**
   * Reconstruit la zone couverte par `cover` (opacité > `threshold`) dans les pixels `base` du
   * calque, puis enregistre le résultat. Sert à la gomme magique et au remplissage d'après le
   * contenu.
   */
  async runInpaint(
    nodeId: string,
    base: HTMLCanvasElement,
    cover: HTMLCanvasElement,
    threshold: number,
  ): Promise<void> {
    const W = base.width,
      H = base.height;
    const cd = cover.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
    let x0 = W,
      y0 = H,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (cd[(y * W + x) * 4 + 3] > threshold) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return;
    // Zone de travail : le trou et ce qui l'entoure, où l'on va chercher de quoi le remplir.
    const m = Math.max(32, Math.round(Math.max(x1 - x0, y1 - y0) * 0.9));
    const rx = Math.max(0, x0 - m),
      ry = Math.max(0, y0 - m);
    const rw = Math.min(W, x1 + m + 1) - rx,
      rh = Math.min(H, y1 + m + 1) - ry;
    const img = base.getContext('2d', { willReadFrequently: true })!.getImageData(rx, ry, rw, rh);
    const hole = new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++)
      for (let x = 0; x < rw; x++) {
        // Le trou est élargi d'un pixel pour ne pas laisser de liseré.
        let on = false;
        for (let dy = -1; dy <= 1 && !on; dy++)
          for (let dx = -1; dx <= 1 && !on; dx++) {
            const gx = rx + x + dx,
              gy = ry + y + dy;
            if (gx >= 0 && gy >= 0 && gx < W && gy < H && cd[(gy * W + gx) * 4 + 3] > threshold) on = true;
          }
        if (on) hole[y * rw + x] = 1;
      }
    ui.set({ busy: { label: t('photo.inpainting'), progress: 0 } });
    try {
      const data = await inpaintAsync(img.data, rw, rh, hole, (f) =>
        ui.set({ busy: { label: t('photo.inpainting'), progress: f } }),
      );
      const out = copyDrawable(base);
      out.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data), rw, rh), rx, ry);
      if (findNode(editor.doc, nodeId)) commitBitmap(nodeId, 'pixels', out, 'history.magicEraser');
    } catch {
      toast(t('photo.inpaintFailed'));
    } finally {
      ui.set({ busy: null });
    }
  }

  // ————— Pot de peinture —————

  private fillAt(p: Vec) {
    const target = this.target('fill', p);
    if (!target) return;
    const px = this.targetPixels(target.node, target.which);
    if (!px) return;
    const { base, toPx } = px;
    const W = base.width,
      H = base.height;
    const q = toPx.transformPoint(new DOMPoint(p.x, p.y));
    if (q.x < 0 || q.y < 0 || q.x >= W || q.y >= H) return;
    const ctx = base.getContext('2d', { willReadFrequently: true })!;
    const img = ctx.getImageData(0, 0, W, H);
    const mask = floodMask(
      { data: img.data, width: W, height: H },
      q.x,
      q.y,
      ui.get().tolerance,
      ui.get().contiguous,
    );
    const sel = selectionIn(W, H, toPx);
    const sd = sel?.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
    const op = brushSettings('brush').opacity / 100;
    const col = parseColor(ui.get().brushColor);
    const d = img.data;
    const value = luminance(ui.get().brushColor) * 255;
    for (let i = 0; i < mask.length; i++) {
      let k = (mask[i] / 255) * op;
      if (sd) k *= sd[i * 4 + 3] / 255;
      if (k <= 0) continue;
      const j = i * 4;
      if (target.which === 'mask') {
        d[j + 3] = d[j + 3] + (value - d[j + 3]) * k;
        d[j] = d[j + 1] = d[j + 2] = 255;
        continue;
      }
      // Couleur posée par-dessus (fusion normale).
      const a = d[j + 3] / 255;
      const outA = k + a * (1 - k);
      if (outA <= 0) continue;
      d[j] = (col.r * k + d[j] * a * (1 - k)) / outA;
      d[j + 1] = (col.g * k + d[j + 1] * a * (1 - k)) / outA;
      d[j + 2] = (col.b * k + d[j + 2] * a * (1 - k)) / outA;
      d[j + 3] = outA * 255;
    }
    const out = makeCanvas(W, H);
    out.getContext('2d')!.putImageData(img, 0, 0);
    commitBitmap(
      target.node.id,
      target.which,
      out,
      target.which === 'mask' ? 'history.maskPaint' : 'history.fill',
    );
  }

  // ————— Dessin —————

  /** Dessine les aides de la Persona Photo, en pixels d'écran. */
  draw(ctx: CanvasRenderingContext2D): void {
    const view = ui.get().view;
    const toScreen = (p: Vec) => this.c.toScreen(p);
    // Aperçu rouge de la gomme magique, posé sur le calque.
    const s = this.stroke;
    if (s?.tint) {
      ctx.save();
      const dpr = ctx.getTransform().a;
      const screen = new DOMMatrix([
        dpr * view.zoom,
        0,
        0,
        dpr * view.zoom,
        dpr * view.panX,
        dpr * view.panY,
      ]);
      ctx.setTransform(screen.multiply(s.toPx.inverse()));
      ctx.drawImage(s.tint, 0, 0);
      ctx.restore();
    }
    // Fourmis de la sélection.
    const outline = selectionOutline();
    if (outline) {
      const offset = (Date.now() / 60) % 8;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const line of outline.lines) {
        for (let i = 0; i < line.length; i += 2) {
          const sp = toScreen(outline.toDoc(line[i], line[i + 1]));
          if (i === 0) ctx.moveTo(Math.round(sp.x) + 0.5, Math.round(sp.y) + 0.5);
          else ctx.lineTo(Math.round(sp.x) + 0.5, Math.round(sp.y) + 0.5);
        }
      }
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.strokeStyle = '#000000';
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -offset;
      ctx.stroke();
      ctx.restore();
    }
    const dashed = (draw: () => void) => {
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      draw();
      ctx.stroke();
      ctx.strokeStyle = '#000000';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    };
    if (this.marquee) {
      const a = toScreen(this.marquee.start),
        b = toScreen(this.marquee.current);
      const x = Math.min(a.x, b.x),
        y = Math.min(a.y, b.y),
        w = Math.abs(b.x - a.x),
        h = Math.abs(b.y - a.y);
      dashed(() => {
        ctx.beginPath();
        if (this.marquee!.shape === 'rect') ctx.rect(Math.round(x) + 0.5, Math.round(y) + 0.5, w, h);
        else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      });
    }
    if (this.lasso && this.lasso.points.length > 1) {
      const pts = this.lasso.points.map(toScreen);
      dashed(() => {
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      });
    }
    // Source du tampon.
    const tool = ui.get().tool;
    if (tool === 'clone' && this.cloneSource && ui.get().persona === 'photo') {
      let src = this.cloneSource;
      if (this.cloneOffset && this.pointer) {
        const w = this.c.toWorld(this.pointer.x, this.pointer.y);
        src = { x: w.x + this.cloneOffset.x, y: w.y + this.cloneOffset.y };
      }
      const q = toScreen(src);
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(q.x - 8, q.y);
      ctx.lineTo(q.x + 8, q.y);
      ctx.moveTo(q.x, q.y - 8);
      ctx.lineTo(q.x, q.y + 8);
      ctx.stroke();
      ctx.restore();
    }
    // Contour du pinceau sous le pointeur.
    if (this.pointer && isBrushTool(tool) && ui.get().persona === 'photo') {
      const r = (brushSettings(tool).size / 2) * view.zoom;
      const { x, y } = this.pointer;
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, r - 1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Remplissage d'après le contenu : reconstruit la sélection dans le calque choisi. */
  async contentAwareFill(): Promise<void> {
    const node = selectedImage();
    if (!node || !getSelection()) return;
    const px = this.targetPixels(node, 'pixels');
    if (!px) return;
    const cover = selectionIn(px.base.width, px.base.height, px.toPx);
    if (!cover) return;
    await this.runInpaint(node.id, px.base, cover, 100);
  }
}
