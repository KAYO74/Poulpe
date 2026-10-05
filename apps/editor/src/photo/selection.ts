import {
  findArtboard,
  findNode,
  floodMask,
  gaussianBlurred,
  maskOutline,
  type Box,
  type ImageNode,
  type Vec,
} from '@poulpe/core';
import { drawArtboard, type ImageCache } from '@poulpe/render';
import { editor, ui, type SelectionMode } from '../store';
import { recordStep } from '../macros/recorder';

/*
 * Sélection de pixels de la Persona Photo (rectangle, ellipse, lasso, baguette magique).
 *
 * C'est un masque : une toile dont seule l'opacité compte, posée sur le plan de travail actif.
 * Sa résolution suit celle de la photo (`scale` pixels du masque par pixel du document), pour que
 * les bords restent nets sur une grande image. La sélection ne fait pas partie du document ni de
 * l'historique, comme dans Affinity.
 */

export interface SelectionMask {
  canvas: HTMLCanvasElement;
  /** Coin haut gauche, en coordonnées du document. */
  x: number;
  y: number;
  /** Pixels du masque par pixel du document. */
  scale: number;
}

const MAX_SIDE = 4096;
let current: SelectionMask | null = null;
let version = 0;
let outlineCache: { version: number; lines: number[][]; k: number } | null = null;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function changed(): void {
  version++;
  outlineCache = null;
  ui.set({ hasPixelSelection: current !== null });
}

export function getSelection(): SelectionMask | null {
  return current;
}

export function selectionVersion(): number {
  return version;
}

export function clearSelection(): void {
  if (!current) return;
  current = null;
  changed();
}

/** Densité de la photo sélectionnée (pixels de l'image par pixel du document). */
function density(): number {
  const sel = editor.selection;
  let d = 1;
  for (const id of sel) {
    const n = findNode(editor.doc, id)?.node;
    if (n?.type === 'image') {
      const a = editor.doc.assets[n.assetId];
      if (a) d = Math.max(d, (a.width * (n.crop?.width ?? 1)) / Math.max(1, n.width));
    }
  }
  return d;
}

/** Cadre d'une nouvelle sélection : le plan de travail actif, à la résolution de la photo. */
function frame(): { box: Box; scale: number } | null {
  const ab = findArtboard(editor.doc, editor.getState().activeArtboardId) ?? editor.doc.artboards[0];
  if (!ab) return null;
  if (current)
    return {
      box: {
        x: current.x,
        y: current.y,
        width: current.canvas.width / current.scale,
        height: current.canvas.height / current.scale,
      },
      scale: current.scale,
    };
  const scale = Math.min(density(), MAX_SIDE / Math.max(ab.width, ab.height));
  return { box: { x: ab.x, y: ab.y, width: ab.width, height: ab.height }, scale: Math.max(0.25, scale) };
}

/** Nouvelle toile de masque vide, dans le cadre de la sélection. */
function blank(): SelectionMask | null {
  const f = frame();
  if (!f) return null;
  return {
    canvas: makeCanvas(f.box.width * f.scale, f.box.height * f.scale),
    x: f.box.x,
    y: f.box.y,
    scale: f.scale,
  };
}

/** Ctx dessinant en coordonnées du document dans un masque. */
function docCtx(m: SelectionMask): CanvasRenderingContext2D {
  const ctx = m.canvas.getContext('2d')!;
  ctx.setTransform(m.scale, 0, 0, m.scale, -m.x * m.scale, -m.y * m.scale);
  return ctx;
}

/** Floute l'opacité d'un masque (adoucissement), `radius` en pixels du document. */
function blurMask(m: SelectionMask, radius: number): void {
  if (radius <= 0) return;
  const ctx = m.canvas.getContext('2d')!;
  const { width: w, height: h } = m.canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const out = gaussianBlurred({ data: img.data, width: w, height: h }, (radius * m.scale) / 2);
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
}

/** Combine une forme (masque dans le même cadre) avec la sélection courante. */
function combine(shape: SelectionMask, mode: SelectionMode): void {
  if (mode === 'replace' || !current) {
    if (mode === 'subtract' || mode === 'intersect') {
      current = null;
      changed();
      return;
    }
    current = shape;
    changed();
    return;
  }
  const ctx = current.canvas.getContext('2d')!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation =
    mode === 'add' ? 'source-over' : mode === 'subtract' ? 'destination-out' : 'destination-in';
  ctx.drawImage(shape.canvas, 0, 0);
  ctx.restore();
  if (isEmpty(current)) current = null;
  changed();
}

function isEmpty(m: SelectionMask): boolean {
  // Échantillonnage rapide sur une petite copie.
  const s = makeCanvas(Math.min(256, m.canvas.width), Math.min(256, m.canvas.height));
  const ctx = s.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(m.canvas, 0, 0, s.width, s.height);
  const d = ctx.getImageData(0, 0, s.width, s.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return false;
  return true;
}

/** Sélection rectangulaire, elliptique ou à main levée (points du document). */
export function selectShape(kind: 'rect' | 'ellipse' | 'polygon', points: Vec[], mode: SelectionMode): void {
  const shape = blank();
  if (!shape || points.length < 2) return;
  const ctx = docCtx(shape);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  if (kind === 'polygon') {
    ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
  } else {
    const [a, b] = points;
    const x = Math.min(a.x, b.x),
      y = Math.min(a.y, b.y),
      w = Math.abs(b.x - a.x),
      h = Math.abs(b.y - a.y);
    if (w < 0.5 || h < 0.5) {
      if (mode === 'replace') clearSelection();
      return;
    }
    if (kind === 'rect') ctx.rect(x, y, w, h);
    else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  }
  ctx.fill();
  blurMask(shape, ui.get().feather);
  combine(shape, mode);
}

/** Baguette magique : pixels semblables, d'après l'image visible du plan de travail. */
export function selectSimilar(p: Vec, images: ImageCache, mode: SelectionMode): void {
  const shape = blank();
  if (!shape) return;
  const ab = editor.doc.artboards.find(
    (a) => p.x >= a.x && p.y >= a.y && p.x <= a.x + a.width && p.y <= a.y + a.height,
  );
  if (!ab) return;
  const { width: w, height: h } = shape.canvas;
  const src = makeCanvas(w, h);
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  sctx.setTransform(shape.scale, 0, 0, shape.scale, -shape.x * shape.scale, -shape.y * shape.scale);
  drawArtboard(sctx, editor.doc, ab, { images });
  const px = sctx.getImageData(0, 0, w, h);
  const mask = floodMask(
    { data: px.data, width: w, height: h },
    (p.x - shape.x) * shape.scale,
    (p.y - shape.y) * shape.scale,
    ui.get().tolerance,
    ui.get().contiguous,
  );
  const out = new ImageData(w, h);
  for (let i = 0; i < mask.length; i++) {
    out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = 255;
    out.data[i * 4 + 3] = mask[i];
  }
  shape.canvas.getContext('2d')!.putImageData(out, 0, 0);
  combine(shape, mode);
}

export function selectAll(): void {
  current = null;
  const m = blank();
  if (!m) return;
  const ctx = m.canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, m.canvas.width, m.canvas.height);
  current = m;
  changed();
}

export function invertSelection(): void {
  const m = blank();
  if (!m) return;
  const ctx = m.canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, m.canvas.width, m.canvas.height);
  if (current) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.drawImage(current.canvas, 0, 0);
  }
  current = isEmpty(m) ? null : m;
  changed();
}

/** Adoucir, agrandir ou réduire la sélection, de `radius` pixels du document. */
export function modifySelection(kind: 'feather' | 'grow' | 'shrink', radius: number): void {
  if (!current || radius <= 0) return;
  recordStep({ kind: 'selectionModify', mode: kind, radius });
  const m = current;
  if (kind === 'feather') {
    blurMask(m, radius * 2);
  } else {
    // Agrandir ou réduire : flou puis seuil bas (agrandir) ou haut (réduire).
    blurMask(m, radius * 2);
    const ctx = m.canvas.getContext('2d')!;
    const img = ctx.getImageData(0, 0, m.canvas.width, m.canvas.height);
    const d = img.data;
    const [lo, hi] = kind === 'grow' ? [4, 40] : [215, 251];
    for (let i = 3; i < d.length; i += 4) {
      const a = d[i];
      d[i] = a <= lo ? 0 : a >= hi ? 255 : Math.round(((a - lo) / (hi - lo)) * 255);
      d[i - 3] = d[i - 2] = d[i - 1] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  if (isEmpty(m)) current = null;
  changed();
}

/** Sélection d'après l'opacité d'un calque de pixels. */
export function selectFromLayer(node: ImageNode, images: ImageCache): void {
  current = null;
  const m = blank();
  if (!m) return;
  const img = images.get(editor.doc, node.assetId);
  if (!img) return;
  const ctx = docCtx(m);
  ctx.translate(node.x + node.width / 2, node.y + node.height / 2);
  ctx.rotate((node.rotation * Math.PI) / 180);
  ctx.translate(-node.width / 2, -node.height / 2);
  const c = node.crop;
  const iw = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const ih = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  if (c) ctx.drawImage(img, c.x * iw, c.y * ih, c.width * iw, c.height * ih, 0, 0, node.width, node.height);
  else ctx.drawImage(img, 0, 0, node.width, node.height);
  current = isEmpty(m) ? null : m;
  changed();
}

/**
 * Contour de la sélection pour les fourmis, en lignes brisées du document. Calculé sur une
 * copie réduite du masque, et mémorisé tant que la sélection ne change pas.
 */
export function selectionOutline(): { lines: number[][]; toDoc: (x: number, y: number) => Vec } | null {
  const m = current;
  if (!m) return null;
  if (!outlineCache || outlineCache.version !== version) {
    const k = Math.min(1, 1200 / Math.max(m.canvas.width, m.canvas.height));
    const w = Math.max(1, Math.round(m.canvas.width * k)),
      h = Math.max(1, Math.round(m.canvas.height * k));
    const s = makeCanvas(w, h);
    const ctx = s.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(m.canvas, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = d[i * 4 + 3];
    outlineCache = { version, lines: maskOutline(alpha, w, h), k: (m.canvas.width / w) * m.scale };
  }
  const { lines, k } = outlineCache;
  return { lines, toDoc: (x, y) => ({ x: m.x + x / k, y: m.y + y / k }) };
}

/**
 * La sélection dessinée dans un autre repère : `toTarget` passe des coordonnées du document à
 * celles de la toile cible (pixels d'un calque, de son masque…). Renvoie null sans sélection.
 */
export function selectionIn(width: number, height: number, toTarget: DOMMatrix): HTMLCanvasElement | null {
  const m = current;
  if (!m) return null;
  const c = makeCanvas(width, height);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(toTarget.multiply(new DOMMatrix().translate(m.x, m.y).scale(1 / m.scale)));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(m.canvas, 0, 0);
  return c;
}

/**
 * Sélection d'après un masque d'opacité posé sur un calque image (le sujet trouvé par le
 * détourage automatique). `matte` couvre la partie visible (recadrée) de l'image.
 */
export function selectFromMatte(node: ImageNode, matte: HTMLCanvasElement, mode: SelectionMode): void {
  const keep = mode === 'replace' ? null : current;
  current = null;
  const shape = blank();
  current = keep;
  if (!shape) return;
  const ctx = docCtx(shape);
  ctx.translate(node.x + node.width / 2, node.y + node.height / 2);
  ctx.rotate((node.rotation * Math.PI) / 180);
  ctx.translate(-node.width / 2, -node.height / 2);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(matte, 0, 0, node.width, node.height);
  if (mode === 'replace' && isEmpty(shape)) {
    clearSelection();
    return;
  }
  combine(shape, mode);
}
