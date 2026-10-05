import type { Pixels } from './adjust';

/*
 * Tables de correspondance de couleurs 3D (LUT), comme les fichiers `.cube` des logiciels photo
 * et vidéo : à chaque couleur d'une grille de `size`³ points correspond une couleur de sortie,
 * les autres sont interpolées (interpolation trilinéaire).
 *
 * Dans le document, une table est rangée en texte : des entiers de 16 bits (0 à 65535), rouge
 * qui varie le plus vite, puis vert, puis bleu (l'ordre des fichiers `.cube`), encodés en base64.
 */

export interface Lut3D {
  size: number;
  /** `size`³ × 3 valeurs de 0 à 1. */
  data: Float32Array;
}

export class LutError extends Error {}

/** Lit un fichier `.cube` (Adobe / Resolve). Seules les tables 3D sont prises en charge. */
export function parseCube(text: string): Lut3D & { title?: string } {
  let size = 0;
  let title: string | undefined;
  let min = [0, 0, 0],
    max = [1, 1, 1];
  const values: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const key = parts[0].toUpperCase();
    if (key === 'TITLE') title = line.slice(5).trim().replace(/^"|"$/g, '');
    else if (key === 'LUT_3D_SIZE') size = Number(parts[1]);
    else if (key === 'LUT_1D_SIZE') throw new LutError('Table 1D non prise en charge');
    else if (key === 'DOMAIN_MIN') min = parts.slice(1, 4).map(Number);
    else if (key === 'DOMAIN_MAX') max = parts.slice(1, 4).map(Number);
    else if (/^[-+.\deE]/.test(parts[0]) && parts.length >= 3)
      values.push(Number(parts[0]), Number(parts[1]), Number(parts[2]));
  }
  if (!Number.isInteger(size) || size < 2 || size > 128) throw new LutError('Taille de table invalide');
  if (values.length !== size * size * size * 3) throw new LutError('Nombre de valeurs incorrect');
  const data = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const c = i % 3;
    const v = (values[i] - min[c]) / (max[c] - min[c] || 1);
    data[i] = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
  }
  return { size, data, title };
}

/** Écrit une table au format `.cube`. */
export function writeCube(lut: Lut3D, title = 'Poulpe'): string {
  const lines = [`TITLE "${title}"`, `LUT_3D_SIZE ${lut.size}`];
  for (let i = 0; i < lut.data.length; i += 3)
    lines.push(`${lut.data[i].toFixed(6)} ${lut.data[i + 1].toFixed(6)} ${lut.data[i + 2].toFixed(6)}`);
  return lines.join('\n') + '\n';
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + 0x8000)));
  return btoa(s);
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Table → texte rangé dans le document. */
export function encodeLut(lut: Lut3D): string {
  const bytes = new Uint8Array(lut.data.length * 2);
  for (let i = 0; i < lut.data.length; i++) {
    const v = Math.round(Math.min(1, Math.max(0, lut.data[i])) * 65535);
    bytes[i * 2] = v & 255;
    bytes[i * 2 + 1] = v >> 8;
  }
  return toBase64(bytes);
}

const decoded = new Map<string, Float32Array>();

/** Texte du document → valeurs de la table (mémorisées : une table sert à chaque rendu). */
export function decodeLut(size: number, text: string): Lut3D {
  let data = decoded.get(text);
  if (!data) {
    const bytes = fromBase64(text);
    const n = size * size * size * 3;
    data = new Float32Array(n);
    for (let i = 0; i < n && i * 2 + 1 < bytes.length; i++)
      data[i] = (bytes[i * 2] | (bytes[i * 2 + 1] << 8)) / 65535;
    if (decoded.size > 16) decoded.delete(decoded.keys().next().value!);
    decoded.set(text, data);
  }
  return { size, data };
}

/** Applique une table aux pixels, sur place (interpolation trilinéaire). */
export function applyLut(px: Pixels, lut: Lut3D): void {
  const { size: N, data: L } = lut;
  const d = px.data;
  const k = (N - 1) / 255;
  const N2 = N * N;
  for (let i = 0; i < d.length; i += 4) {
    const fr = d[i] * k,
      fg = d[i + 1] * k,
      fb = d[i + 2] * k;
    const r0 = Math.min(N - 2, fr | 0),
      g0 = Math.min(N - 2, fg | 0),
      b0 = Math.min(N - 2, fb | 0);
    const tr = fr - r0,
      tg = fg - g0,
      tb = fb - b0;
    const base = (b0 * N2 + g0 * N + r0) * 3;
    const o100 = 3,
      o010 = N * 3,
      o001 = N2 * 3;
    for (let c = 0; c < 3; c++) {
      const p = base + c;
      const c00 = L[p] + (L[p + o100] - L[p]) * tr;
      const c10 = L[p + o010] + (L[p + o010 + o100] - L[p + o010]) * tr;
      const c01 = L[p + o001] + (L[p + o001 + o100] - L[p + o001]) * tr;
      const c11 = L[p + o001 + o010] + (L[p + o001 + o010 + o100] - L[p + o001 + o010]) * tr;
      const c0 = c00 + (c10 - c00) * tg;
      const c1 = c01 + (c11 - c01) * tg;
      d[i + c] = (c0 + (c1 - c0) * tb) * 255 + 0.5;
    }
  }
}

/** Table construite à partir d'une fonction couleur → couleur (valeurs de 0 à 1). */
export function lutFromFunction(
  size: number,
  fn: (r: number, g: number, b: number) => [number, number, number],
): Lut3D {
  const data = new Float32Array(size * size * size * 3);
  let i = 0;
  for (let b = 0; b < size; b++)
    for (let g = 0; g < size; g++)
      for (let r = 0; r < size; r++) {
        const [R, G, B] = fn(r / (size - 1), g / (size - 1), b / (size - 1));
        data[i++] = Math.min(1, Math.max(0, R));
        data[i++] = Math.min(1, Math.max(0, G));
        data[i++] = Math.min(1, Math.max(0, B));
      }
  return { size, data };
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Looks prêts à l'emploi, construits par calcul (pas de fichier à fournir). */
export const LUT_PRESETS = {
  /** Ombres sarcelle, tons chair orangés : l'étalonnage des films d'action. */
  tealOrange: (r: number, g: number, b: number): [number, number, number] => {
    const l = lum(r, g, b);
    const t = smooth(l);
    const tr = mix(0.0, 1.0, t),
      tg = mix(0.32, 0.55, t),
      tb = mix(0.36, 0.2, t);
    return [mix(r, tr * l * 1.6, 0.35), mix(g, tg * l * 1.6, 0.25), mix(b, tb * l * 1.6, 0.35)];
  },
  /** Pellicule chaude et douce : noirs relevés, couleurs un peu passées. */
  warmFilm: (r: number, g: number, b: number): [number, number, number] => {
    const f = (v: number) => 0.06 + 0.9 * smooth(v);
    return [f(r) * 1.04 + 0.02, f(g) * 0.99 + 0.01, f(b) * 0.88 + 0.03];
  },
  /** Ambiance froide et bleutée. */
  cool: (r: number, g: number, b: number): [number, number, number] => [
    r * 0.92,
    g * 0.98 + 0.01,
    b * 1.06 + 0.03,
  ],
  /** Couleurs délavées, contraste doux (style « mat »). */
  faded: (r: number, g: number, b: number): [number, number, number] => {
    const l = lum(r, g, b);
    const f = (v: number) => 0.12 + 0.78 * mix(v, l, 0.3);
    return [f(r), f(g), f(b)];
  },
  /** Sépia : noir et blanc teinté brun. */
  sepia: (r: number, g: number, b: number): [number, number, number] => {
    const l = smooth(lum(r, g, b));
    return [l * 1.07 + 0.03, l * 0.92 + 0.02, l * 0.72];
  },
  /** Noir et blanc contrasté. */
  noir: (r: number, g: number, b: number): [number, number, number] => {
    const l = smooth(smooth(lum(r, g, b)));
    return [l, l, l];
  },
} as const;

export type LutPreset = keyof typeof LUT_PRESETS;
