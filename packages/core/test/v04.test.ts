import { describe, expect, it } from 'vitest';
import {
  FORMAT_VERSION,
  applyAdjustment,
  artboardToSvg,
  autoLevels,
  createAdjustment,
  createDocument,
  createImage,
  curveTable,
  decodePoulpe,
  defaultAdjustment,
  encodePoulpe,
  floodMask,
  gaussianBlurred,
  histogram,
  inpaint,
  maskBounds,
  maskOutline,
  migrate,
  type Adjustment,
  type Pixels,
} from '../src';

function solid(w: number, h: number, rgba: [number, number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return { data, width: w, height: h };
}

function pixel(px: Pixels, x: number, y: number): number[] {
  const i = (y * px.width + x) * 4;
  return [...px.data.slice(i, i + 4)];
}

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('réglages', () => {
  it('inverse, seuil et postérisation', () => {
    const px = solid(2, 1, [10, 100, 200, 255]);
    applyAdjustment(px, { kind: 'invert' });
    expect(pixel(px, 0, 0)).toEqual([245, 155, 55, 255]);
    applyAdjustment(px, { kind: 'threshold', level: 128 });
    expect(pixel(px, 1, 0)).toEqual([255, 255, 255, 255]);
    const p2 = solid(1, 1, [100, 100, 100, 255]);
    applyAdjustment(p2, { kind: 'posterize', levels: 2 });
    expect(pixel(p2, 0, 0)).toEqual([0, 0, 0, 255]);
  });

  it('niveaux, courbes et exposition', () => {
    const px = solid(1, 1, [64, 128, 192, 255]);
    applyAdjustment(px, { kind: 'levels', black: 64, white: 192, gamma: 1, outBlack: 0, outWhite: 255 });
    expect(pixel(px, 0, 0)).toEqual([0, 128, 255, 255]);
    const t = curveTable([
      [0, 0],
      [0.5, 0.75],
      [1, 1],
    ]);
    expect(t[0]).toBe(0);
    expect(t[128]).toBeGreaterThan(0.7);
    expect(t[255]).toBe(1);
    // Une courbe monotone ne redescend jamais.
    for (let i = 1; i < 256; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1] - 1e-6);
    const ex = solid(1, 1, [100, 100, 100, 255]);
    applyAdjustment(ex, { kind: 'exposure', exposure: 1, offset: 0, gamma: 1 });
    expect(pixel(ex, 0, 0)[0]).toBeGreaterThan(130);
  });

  it('teinte et saturation, noir et blanc, vibrance', () => {
    const red = solid(1, 1, [255, 0, 0, 255]);
    applyAdjustment(red, { kind: 'hsl', hue: 120, saturation: 0, lightness: 0 });
    const [r, g, b] = pixel(red, 0, 0);
    expect(g).toBeGreaterThan(250);
    expect(r).toBeLessThan(5);
    expect(b).toBeLessThan(5);
    const gray = solid(1, 1, [200, 50, 50, 255]);
    applyAdjustment(gray, defaultAdjustment('blackWhite'));
    const [gr, gg, gb] = pixel(gray, 0, 0);
    expect(gr).toBe(gg);
    expect(gg).toBe(gb);
    const dull = solid(1, 1, [140, 120, 110, 255]);
    applyAdjustment(dull, { kind: 'vibrance', vibrance: 100, saturation: 0 });
    const [vr, , vb] = pixel(dull, 0, 0);
    expect(vr - vb).toBeGreaterThan(30);
  });

  it("garde l'opacité des pixels", () => {
    const px = solid(1, 1, [50, 60, 70, 90]);
    for (const kind of ['brightnessContrast', 'hsl', 'gradientMap', 'photoFilter', 'colorBalance'] as const) {
      const adj = defaultAdjustment(kind);
      if (adj.kind === 'brightnessContrast') adj.brightness = 40;
      applyAdjustment(px, adj);
      expect(pixel(px, 0, 0)[3]).toBe(90);
    }
  });

  it('flou gaussien : lisse un bord net sans changer une zone unie', () => {
    const px = solid(20, 1, [0, 0, 0, 255]);
    for (let x = 10; x < 20; x++) px.data.set([255, 255, 255, 255], x * 4);
    const out = gaussianBlurred(px, 2);
    expect(out[9 * 4]).toBeGreaterThan(40);
    expect(out[9 * 4]).toBeLessThan(215);
    expect(out[0]).toBe(0);
    expect(out[19 * 4]).toBe(255);
  });

  it('netteté, vignette, pixellisation et grain', () => {
    const px = solid(20, 1, [100, 100, 100, 255]);
    for (let x = 10; x < 20; x++) px.data.set([150, 150, 150, 255], x * 4);
    applyAdjustment(px, { kind: 'unsharpMask', amount: 100, radius: 2, threshold: 0 });
    expect(pixel(px, 9, 0)[0]).toBeLessThan(100);
    expect(pixel(px, 10, 0)[0]).toBeGreaterThan(150);

    const v = solid(21, 21, [200, 200, 200, 255]);
    applyAdjustment(v, { kind: 'vignette', amount: 100, size: 30, softness: 30 });
    expect(pixel(v, 10, 10)[0]).toBe(200);
    expect(pixel(v, 0, 0)[0]).toBeLessThan(60);

    const p = solid(4, 4, [0, 0, 0, 255]);
    p.data.set([255, 255, 255, 255], 0);
    applyAdjustment(p, { kind: 'pixelate', size: 2 });
    expect(pixel(p, 1, 1)[0]).toBe(pixel(p, 0, 0)[0]);
    expect(pixel(p, 0, 0)[0]).toBeGreaterThan(50);

    const n1 = solid(8, 8, [128, 128, 128, 255]);
    const n2 = solid(8, 8, [128, 128, 128, 255]);
    applyAdjustment(n1, { kind: 'noise', amount: 20, monochrome: true });
    applyAdjustment(n2, { kind: 'noise', amount: 20, monochrome: true });
    expect([...n1.data]).toEqual([...n2.data]);
    expect(new Set(n1.data).size).toBeGreaterThan(3);
  });

  it('histogramme et niveaux automatiques', () => {
    const px = solid(10, 1, [100, 100, 100, 255]);
    for (let x = 5; x < 10; x++) px.data.set([150, 150, 150, 255], x * 4);
    const h = histogram(px);
    expect(h.r[100]).toBe(5);
    expect(h.r[150]).toBe(5);
    const lv = autoLevels(px);
    expect(lv.black).toBeGreaterThanOrEqual(99);
    expect(lv.white).toBeLessThanOrEqual(151);
  });
});

describe('masques de pixels', () => {
  it('baguette magique : zone contiguë ou couleur partout', () => {
    const px = solid(6, 3, [255, 255, 255, 255]);
    for (let y = 0; y < 3; y++) px.data.set([0, 0, 0, 255], (y * 6 + 2) * 4);
    px.data.set([250, 250, 250, 255], (1 * 6 + 5) * 4);
    const m = floodMask(px, 0, 0, 10, true);
    expect(m[0]).toBe(255);
    expect(m[1]).toBe(255);
    expect(m[3]).toBe(0);
    const all = floodMask(px, 0, 0, 10, false);
    expect(all[3]).toBe(255);
    expect(all[1 * 6 + 5]).toBe(255);
    expect(maskBounds(m, 6, 3)).toEqual({ x: 0, y: 0, width: 2, height: 3 });
  });

  it('contour de sélection : un carré donne une boucle de quatre coins', () => {
    const w = 5,
      h = 5;
    const m = new Uint8Array(w * h);
    for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) m[y * w + x] = 255;
    const lines = maskOutline(m, w, h);
    expect(lines.length).toBe(1);
    const pts = lines[0];
    const xs = pts.filter((_, i) => i % 2 === 0),
      ys = pts.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBe(1);
    expect(Math.max(...xs)).toBe(4);
    expect(Math.min(...ys)).toBe(1);
    expect(Math.max(...ys)).toBe(4);
    expect(pts.length).toBeLessThanOrEqual(12);
  });
});

describe('gomme magique', () => {
  it('efface un objet sur un fond uni', () => {
    const px = solid(48, 48, [40, 120, 200, 255]);
    const hole = new Uint8Array(48 * 48);
    for (let y = 18; y < 30; y++)
      for (let x = 18; x < 30; x++) {
        px.data.set([255, 0, 0, 255], (y * 48 + x) * 4);
        hole[y * 48 + x] = 1;
      }
    inpaint(px, hole);
    const [r, g, b] = pixel(px, 24, 24);
    expect(Math.abs(r - 40)).toBeLessThan(6);
    expect(Math.abs(g - 120)).toBeLessThan(6);
    expect(Math.abs(b - 200)).toBeLessThan(6);
  });

  it('prolonge un motif rayé', () => {
    const W = 64;
    const px = solid(W, W, [0, 0, 0, 255]);
    for (let y = 0; y < W; y++)
      for (let x = 0; x < W; x++)
        if (Math.floor(x / 4) % 2 === 0) px.data.set([255, 255, 255, 255], (y * W + x) * 4);
    const ref = new Uint8ClampedArray(px.data);
    const hole = new Uint8Array(W * W);
    for (let y = 26; y < 38; y++)
      for (let x = 26; x < 38; x++) {
        hole[y * W + x] = 1;
        px.data.set([128, 0, 128, 255], (y * W + x) * 4);
      }
    inpaint(px, hole, { seed: 7 });
    let err = 0,
      n = 0;
    for (let y = 26; y < 38; y++)
      for (let x = 26; x < 38; x++) {
        const i = (y * W + x) * 4;
        err += Math.abs(px.data[i] - ref[i]);
        n++;
      }
    // Les rayures sont reconstruites (une erreur moyenne de 128 serait du gris uniforme).
    expect(err / n).toBeLessThan(70);
    // Plus aucune trace du violet.
    expect(px.data[(32 * W + 32) * 4 + 1]).toBe(px.data[(32 * W + 32) * 4]);
  });

  it('ne touche pas aux pixels hors du trou', () => {
    const px = solid(32, 32, [10, 20, 30, 255]);
    px.data.set([200, 200, 200, 255], (5 * 32 + 5) * 4);
    const hole = new Uint8Array(32 * 32);
    hole[16 * 32 + 16] = 1;
    inpaint(px, hole);
    expect(pixel(px, 5, 5)).toEqual([200, 200, 200, 255]);
  });
});

describe('format 4', () => {
  it('enregistre et relit calques de réglage et masques', () => {
    const doc = createDocument({ width: 100, height: 80 });
    doc.assets.a = { id: 'a', mime: 'image/png', width: 1, height: 1, data: PNG_1PX };
    doc.assets.m = { id: 'm', mime: 'image/png', width: 1, height: 1, data: PNG_1PX };
    const img = createImage({ x: 0, y: 0, width: 100, height: 80, assetId: 'a' });
    img.mask = { assetId: 'm', enabled: true };
    const adj: Adjustment = { kind: 'hsl', hue: 30, saturation: 10, lightness: 0 };
    const layer = createAdjustment({ x: 0, y: 0, width: 100, height: 80, adjustment: adj });
    doc.artboards[0].children.push(img, layer);
    const back = decodePoulpe(encodePoulpe(doc));
    expect(back.version).toBe(FORMAT_VERSION);
    expect(FORMAT_VERSION).toBeGreaterThanOrEqual(4);
    const [bi, ba] = back.artboards[0].children;
    expect(bi.mask).toEqual({ assetId: 'm', enabled: true });
    expect(ba.type === 'adjustment' && ba.adjustment).toEqual(adj);
    expect(back.assets.m.data).toBe(PNG_1PX);
  });

  it('ouvre les documents de la version 3', () => {
    const v3 = { ...createDocument(), version: 3 } as unknown as Record<string, unknown>;
    expect(migrate(v3).version).toBe(FORMAT_VERSION);
  });

  it("export SVG : masque alpha, réglage ignoré (mis en image par l'appli)", () => {
    const doc = createDocument({ width: 100, height: 80 });
    doc.assets.a = { id: 'a', mime: 'image/png', width: 1, height: 1, data: PNG_1PX };
    const img = createImage({ x: 0, y: 0, width: 100, height: 80, assetId: 'a' });
    img.mask = { assetId: 'a', enabled: true };
    doc.artboards[0].children.push(
      img,
      createAdjustment({ x: 0, y: 0, width: 100, height: 80, adjustment: { kind: 'invert' } }),
    );
    const svg = artboardToSvg(doc, doc.artboards[0]);
    expect(svg).toContain('mask-type:alpha');
    expect(svg).toContain('mask="url(#');
  });
});
