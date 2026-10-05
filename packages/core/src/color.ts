import type { Color, GradientPaint, Paint } from './types';

export interface RGBA {
  r: number;
  g: number;
  b: number;
  /** 0 à 1. */
  a: number;
}

export interface HSVA {
  /** 0 à 360. */
  h: number;
  /** 0 à 1. */
  s: number;
  v: number;
  a: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function parseColor(c: Color): RGBA {
  let hex = c.trim().replace(/^#/, '');
  if (hex.length === 3 || hex.length === 4) hex = [...hex].map((ch) => ch + ch).join('');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return { r: 0, g: 0, b: 0, a: 1 };
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: hex.length === 8 ? n(6) / 255 : 1 };
}

/** Accepte une saisie libre (« ff0000 », « #F00 ») ; renvoie null si elle n'est pas valide. */
export function normalizeHex(input: string): Color | null {
  const hex = input.trim().replace(/^#/, '');
  if (!/^([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return null;
  return formatColor(parseColor('#' + hex));
}

const h2 = (n: number) =>
  Math.round(clamp(n, 0, 255))
    .toString(16)
    .padStart(2, '0');

export function formatColor({ r, g, b, a }: RGBA): Color {
  const base = `#${h2(r)}${h2(g)}${h2(b)}`;
  return a >= 1 ? base : base + h2(a * 255);
}

export function withAlpha(c: Color, a: number): Color {
  return formatColor({ ...parseColor(c), a: clamp(a, 0, 1) });
}

export function opaque(c: Color): Color {
  return c.slice(0, 7).toLowerCase();
}

export function alphaOf(c: Color): number {
  return parseColor(c).a;
}

export function rgbaToCss(c: Color): string {
  const { r, g, b, a } = parseColor(c);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${+a.toFixed(3)})`;
}

export function rgbToHsv({ r, g, b, a }: RGBA): HSVA {
  const R = r / 255,
    G = g / 255,
    B = b / 255;
  const max = Math.max(R, G, B),
    min = Math.min(R, G, B),
    d = max - min;
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max, a };
}

export function hsvToRgb({ h, s, v, a }: HSVA): RGBA {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255, a };
}

export function rgbToHsl({ r, g, b }: RGBA): { h: number; s: number; l: number } {
  const R = r / 255,
    G = g / 255,
    B = b / 255;
  const max = Math.max(R, G, B),
    min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  const { h } = rgbToHsv({ r, g, b, a: 1 });
  return { h, s, l };
}

export function hslToRgb(h: number, s: number, l: number, a = 1): RGBA {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const v = l + c / 2;
  return hsvToRgb({ h, s: v ? c / v : 0, v, a });
}

/** Vrai pour un dégradé (linéaire, radial ou conique) : les peintures à échelons de couleur. */
export function isGradient(p: Paint): p is GradientPaint {
  return p.type === 'linear' || p.type === 'radial' || p.type === 'conic';
}

/** Couleur interpolée le long d'un dégradé, utile pour ajouter un arrêt au bon endroit. */
export function sampleStops(stops: { offset: number; color: Color }[], t: number): Color {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  if (!sorted.length) return '#000000';
  if (t <= sorted[0].offset) return sorted[0].color;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1],
      b = sorted[i];
    if (t <= b.offset) {
      const k = b.offset === a.offset ? 0 : (t - a.offset) / (b.offset - a.offset);
      const A = parseColor(a.color),
        B = parseColor(b.color);
      return formatColor({
        r: A.r + (B.r - A.r) * k,
        g: A.g + (B.g - A.g) * k,
        b: A.b + (B.b - A.b) * k,
        a: A.a + (B.a - A.a) * k,
      });
    }
  }
  return sorted[sorted.length - 1].color;
}
