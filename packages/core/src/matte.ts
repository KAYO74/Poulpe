import type { Pixels } from './adjust';

/*
 * Détourage automatique : préparation de l'image pour le modèle d'IA (U²-Net) et affinage de sa
 * réponse. Le modèle voit l'image réduite à 320 × 320 pixels et renvoie une carte « sujet ou
 * fond » floue ; on l'agrandit puis on la recale sur les bords réels de la photo par un filtre
 * guidé (He, Sun et Tang, 2010), pour des cheveux et des contours plus fins.
 *
 * Ces calculs n'utilisent ni DOM ni modèle : ils tournent dans le Web Worker du détourage et
 * dans les tests.
 */

/** Côté de l'image vue par le modèle. */
export const MATTE_INPUT = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** Agrandit ou réduit une carte d'un canal (interpolation bilinéaire, centres de pixels alignés). */
export function resizeChannel(src: Float32Array, w: number, h: number, W: number, H: number): Float32Array {
  const out = new Float32Array(W * H);
  const kx = w / W,
    ky = h / H;
  for (let y = 0; y < H; y++) {
    const fy = Math.min(h - 1, Math.max(0, (y + 0.5) * ky - 0.5));
    const y0 = Math.floor(fy),
      y1 = Math.min(h - 1, y0 + 1),
      ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(w - 1, Math.max(0, (x + 0.5) * kx - 0.5));
      const x0 = Math.floor(fx),
        x1 = Math.min(w - 1, x0 + 1),
        tx = fx - x0;
      const a = src[y0 * w + x0] * (1 - tx) + src[y0 * w + x1] * tx;
      const b = src[y1 * w + x0] * (1 - tx) + src[y1 * w + x1] * tx;
      out[y * W + x] = a * (1 - ty) + b * ty;
    }
  }
  return out;
}

/** Canaux rouge, vert, bleu (0 à 1) d'une image. */
function channels(img: Pixels): Float32Array[] {
  const n = img.width * img.height;
  const out = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[c][i] = img.data[i * 4 + c] / 255;
  return out;
}

/** Tenseur d'entrée du modèle : 1 × 3 × 320 × 320, normalisé comme à l'entraînement. */
export function matteInput(img: Pixels): Float32Array {
  const S = MATTE_INPUT;
  const chans = channels(img).map((c) => resizeChannel(c, img.width, img.height, S, S));
  let max = 0;
  for (const c of chans) for (let i = 0; i < c.length; i++) max = Math.max(max, c[i]);
  max = max || 1;
  const out = new Float32Array(3 * S * S);
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < S * S; i++) out[c * S * S + i] = (chans[c][i] / max - MEAN[c]) / STD[c];
  return out;
}

/** Moyenne sur une fenêtre carrée de rayon r (images intégrales), bords compris. */
function boxMean(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const W = w + 1;
  const sat = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      sat[(y + 1) * W + x + 1] = sat[y * W + x + 1] + row;
    }
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r),
      y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r),
        x1 = Math.min(w, x + r + 1);
      const s = sat[y1 * W + x1] - sat[y0 * W + x1] - sat[y1 * W + x0] + sat[y0 * W + x0];
      out[y * w + x] = s / ((y1 - y0) * (x1 - x0));
    }
  }
  return out;
}

/** Filtre guidé en niveaux de gris : `p` suit les bords de `guide`. */
export function guidedFilter(
  guide: Float32Array,
  p: Float32Array,
  w: number,
  h: number,
  r: number,
  eps: number,
): Float32Array {
  const n = w * h;
  const meanI = boxMean(guide, w, h, r);
  const meanP = boxMean(p, w, h, r);
  const ip = new Float32Array(n),
    ii = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    ip[i] = guide[i] * p[i];
    ii[i] = guide[i] * guide[i];
  }
  const corrIp = boxMean(ip, w, h, r);
  const corrI = boxMean(ii, w, h, r);
  const a = new Float32Array(n),
    b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const varI = corrI[i] - meanI[i] * meanI[i];
    const cov = corrIp[i] - meanI[i] * meanP[i];
    a[i] = cov / (varI + eps);
    b[i] = meanP[i] - a[i] * meanI[i];
  }
  const ma = boxMean(a, w, h, r),
    mb = boxMean(b, w, h, r);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = ma[i] * guide[i] + mb[i];
  return out;
}

/**
 * Masque final (opacité 0 à 255, à la taille de `img`) à partir de la réponse brute du modèle
 * (`raw`, `size` × `size`). `img` est la photo à la résolution de travail (1024 pixels au plus).
 */
export function refineMatte(img: Pixels, raw: Float32Array, size = MATTE_INPUT): Uint8ClampedArray {
  const { width: w, height: h } = img;
  // Réponse ramenée entre 0 et 1, comme le fait rembg.
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i < raw.length; i++) {
    lo = Math.min(lo, raw[i]);
    hi = Math.max(hi, raw[i]);
  }
  const norm = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) norm[i] = (raw[i] - lo) / (hi - lo || 1);
  const coarse = resizeChannel(norm, size, size, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++)
    gray[i] = (0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2]) / 255;
  const r = Math.max(2, Math.round(Math.max(w, h) / 160));
  const fine = guidedFilter(gray, coarse, w, h, r, 1e-3);
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    // Les valeurs presque sûres sont franchies, la zone de doute garde sa transparence.
    const v = (fine[i] - 0.08) / 0.84;
    out[i] = Math.round(Math.max(0, Math.min(1, v)) * 255);
  }
  return out;
}
