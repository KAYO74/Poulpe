import { describe, expect, it } from 'vitest';
import {
  despeckle,
  guidedFilter,
  matteInput,
  parseSvgPath,
  pathToSvg,
  quantize,
  refineMatte,
  resizeChannel,
  traceContours,
  traceImage,
  DEFAULT_TRACE,
  MATTE_INPUT,
  type Pixels,
} from '../src';

function canvas(
  w: number,
  h: number,
  paint: (x: number, y: number) => [number, number, number, number],
): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4);
  return { data, width: w, height: h };
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255];

describe('vectorisation', () => {
  it('trace un carré noir : quatre coins, des segments droits', () => {
    const img = canvas(40, 40, (x, y) => (x >= 10 && x < 30 && y >= 10 && y < 30 ? [0, 0, 0, 255] : WHITE));
    const r = traceImage(img, { mode: 'bw', ignoreWhite: true, noise: 1 });
    expect(r.layers).toHaveLength(1);
    const cmds = r.layers[0].commands;
    expect(cmds.filter((c) => c.op === 'C')).toHaveLength(0);
    expect(r.layers[0].bounds).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });

  it('trace un disque en quelques courbes lisses', () => {
    const img = canvas(100, 100, (x, y) =>
      Math.hypot(x + 0.5 - 50, y + 0.5 - 50) < 30 ? [20, 20, 200, 255] : WHITE,
    );
    const r = traceImage(img, { mode: 'color', colors: 2, ignoreWhite: true, noise: 4 });
    expect(r.layers).toHaveLength(1);
    const cmds = r.layers[0].commands;
    const curves = cmds.filter((c) => c.op === 'C').length;
    expect(curves).toBeGreaterThanOrEqual(4);
    expect(curves).toBeLessThan(20);
    // Les points du tracé restent sur le cercle.
    for (const c of cmds)
      if (c.op === 'C') expect(Math.abs(Math.hypot(c.x - 50, c.y - 50) - 30)).toBeLessThan(1.2);
    // Le tracé se relit tel quel en SVG.
    expect(parseSvgPath(pathToSvg(cmds)).length).toBe(cmds.length);
  });

  it('garde les trous (règle pair-impair) et empile les couleurs sans fente', () => {
    // Un anneau rouge sur fond bleu.
    const img = canvas(60, 60, (x, y) => {
      const d = Math.hypot(x + 0.5 - 30, y + 0.5 - 30);
      return d < 20 && d > 10 ? [220, 30, 30, 255] : [30, 60, 200, 255];
    });
    const r = traceImage(img, { mode: 'color', colors: 2, noise: 4 });
    expect(r.layers).toHaveLength(2);
    // Le fond (le plus étendu) est en dessous et couvre toute l'image.
    expect(r.layers[0].color).toMatch(/^#1e3c|^#1f3c|^#1e3d/);
    expect(r.layers[0].bounds.width).toBeGreaterThan(58);
    // L'anneau : deux boucles (extérieur et trou).
    expect(r.layers[1].commands.filter((c) => c.op === 'M')).toHaveLength(2);
  });

  it('réduit les couleurs et fond les petites taches', () => {
    const img = canvas(30, 30, (x, y) =>
      x === 15 && y === 15 ? [0, 0, 0, 255] : x < 15 ? [255, 0, 0, 255] : [0, 0, 255, 255],
    );
    const { labels, palette } = quantize(img, { ...DEFAULT_TRACE, colors: 3 });
    expect(palette.length / 3).toBe(3);
    const before = new Set(labels).size;
    despeckle(labels, 30, 30, 4);
    expect(new Set(labels).size).toBe(before - 1);
  });

  it('suit les contours des pixels, trous compris', () => {
    const inside = new Uint8Array(25);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) inside[y * 5 + x] = x === 2 && y === 2 ? 0 : 1;
    const loops = traceContours(inside, 5, 5);
    expect(loops).toHaveLength(2);
  });

  it('ignore les pixels transparents', () => {
    const img = canvas(20, 20, () => [0, 0, 0, 0]);
    expect(traceImage(img).layers).toHaveLength(0);
  });
});

describe('détourage', () => {
  it('prépare un tenseur 3 × 320 × 320 normalisé', () => {
    const t = matteInput(canvas(64, 48, () => [255, 255, 255, 255]));
    expect(t.length).toBe(3 * MATTE_INPUT * MATTE_INPUT);
    expect(t[0]).toBeCloseTo((1 - 0.485) / 0.229, 4);
  });

  it('agrandit une carte sans décaler son contenu', () => {
    const src = new Float32Array([0, 1, 0, 1]);
    const out = resizeChannel(src, 2, 2, 4, 4);
    expect(out[0]).toBeCloseTo(0);
    expect(out[3]).toBeCloseTo(1);
  });

  it('le filtre guidé garde une carte uniforme et recale un bord flou sur le bord net', () => {
    const w = 40,
      h = 10;
    const guide = new Float32Array(w * h);
    const p = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        guide[y * w + x] = x < 20 ? 0 : 1;
        p[y * w + x] = Math.min(1, Math.max(0, (x - 14) / 12));
      }
    const flat = guidedFilter(guide, new Float32Array(w * h).fill(0.5), w, h, 3, 1e-3);
    expect(flat[55]).toBeCloseTo(0.5, 4);
    const out = guidedFilter(guide, p, w, h, 3, 1e-4);
    // Le bord devient plus franc : l'écart entre les deux côtés du bord grandit.
    expect(out[5 * w + 21] - out[5 * w + 18]).toBeGreaterThan(p[5 * w + 21] - p[5 * w + 18]);
  });

  it('donne un masque opaque sur le sujet et transparent sur le fond', () => {
    const img = canvas(64, 64, (x, y) =>
      Math.hypot(x - 32, y - 32) < 16 ? [200, 20, 20, 255] : [200, 200, 200, 255],
    );
    const raw = new Float32Array(MATTE_INPUT * MATTE_INPUT);
    for (let y = 0; y < MATTE_INPUT; y++)
      for (let x = 0; x < MATTE_INPUT; x++)
        raw[y * MATTE_INPUT + x] = Math.hypot(x - 160, y - 160) < 80 ? 4 : -4;
    const a = refineMatte(img, raw);
    expect(a[32 * 64 + 32]).toBe(255);
    expect(a[2 * 64 + 2]).toBe(0);
  });
});
