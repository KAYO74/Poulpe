import { describe, expect, it } from 'vitest';
import {
  applyPalette,
  artboardToSvg,
  commandsBounds,
  contrastRatio,
  createDocument,
  createPath,
  createRect,
  createText,
  decodePoulpe,
  designColors,
  encodePoulpe,
  migrate,
  nodeBounds,
  parseSvgPath,
  resizeArtboard,
  shapePath,
  FORMAT_PRESETS,
  FORMAT_VERSION,
} from '../src';

describe('tracés SVG', () => {
  it('convertit les commandes relatives et les raccourcis en M, L, C, Z absolus', () => {
    const cmds = parseSvgPath('m10 10 h20 v20 l-20 0 z M0 0 Q 10 0 10 10 T 20 20 C 1 2 3 4 5 6 S 9 9 10 10');
    expect(cmds.map((c) => c.op).join('')).toBe('MLLLZMCCCC');
    expect(cmds[1]).toEqual({ op: 'L', x: 30, y: 10 });
    expect(cmds[3]).toEqual({ op: 'L', x: 10, y: 30 });
    // La courbe T reprend le symétrique du point de contrôle précédent.
    const t = cmds[7] as Extract<(typeof cmds)[number], { op: 'C' }>;
    expect(t.x).toBe(20);
    expect(t.x1).toBeCloseTo(10 + (2 / 3) * 0);
  });

  it('convertit les arcs, même avec des drapeaux collés', () => {
    const a = parseSvgPath('M0 50 A50 50 0 0 1 100 50');
    const b = parseSvgPath('M0 50a50 50 0 01100 0');
    expect(a.length).toBeGreaterThan(1);
    expect(b).toEqual(a);
    const end = a[a.length - 1] as { x: number; y: number };
    expect(end.x).toBeCloseTo(100);
    expect(end.y).toBeCloseTo(50);
    // Demi-cercle supérieur : il monte jusqu'à y = 0.
    expect(commandsBounds(a)!.y).toBeCloseTo(0, 1);
  });

  it('étire le tracé sur la boîte de l’objet', () => {
    const p = createPath({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      d: 'M0 0H10V10H0Z',
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
    });
    const b = commandsBounds(shapePath(p))!;
    expect(b).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it('s’exporte en SVG et s’enregistre', () => {
    const doc = createDocument({ width: 100, height: 100 });
    const p = createPath({
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      d: 'M0 0H10V10H0Z M2 2H8V8H2Z',
      viewBox: { x: 0, y: 0, width: 10, height: 10 },
      fillRule: 'evenodd',
    });
    doc.artboards[0].children.push(p);
    expect(artboardToSvg(doc, doc.artboards[0])).toContain('fill-rule="evenodd"');
    const back = decodePoulpe(encodePoulpe(doc));
    expect(back.version).toBe(FORMAT_VERSION);
    expect(back.artboards[0].children[0]).toMatchObject({ type: 'path', d: p.d, fillRule: 'evenodd' });
  });

  it('lit les documents de la version 1', () => {
    const doc = createDocument();
    const v1 = { ...JSON.parse(JSON.stringify(doc)), version: 1 };
    expect(migrate(v1).version).toBe(2);
  });
});

describe('formats', () => {
  it('ont des identifiants uniques et une catégorie', () => {
    const ids = FORMAT_PRESETS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FORMAT_PRESETS) expect(['social', 'print', 'screen']).toContain(f.category);
  });
});

describe('redimensionnement d’un design', () => {
  function design() {
    const doc = createDocument({ width: 1080, height: 1080 });
    const ab = doc.artboards[0];
    const bg = createRect({ x: 0, y: 0, width: 1080, height: 1080 });
    const logo = createRect({ x: 0, y: 0, width: 100, height: 100 });
    const badge = createRect({ x: 940, y: 940, width: 140, height: 140 });
    const title = createText({ x: 340, y: 400, width: 400, height: 80, text: 'Titre' });
    const band = createRect({ x: 0, y: 600, width: 1080, height: 120 });
    const label = createText({ x: 440, y: 630, width: 200, height: 60, text: 'Bandeau' });
    ab.children.push(bg, logo, badge, title, band, label);
    return { ab, bg, logo, badge, title, band, label };
  }

  it('carré vers story : fond étiré, objets collés à leur bord, texte non déformé', () => {
    const { ab, bg, logo, badge, title, band, label } = design();
    resizeArtboard(ab, 1080, 1920);
    expect(ab.height).toBe(1920);
    expect(nodeBounds(bg)).toMatchObject({ x: 0, y: 0, width: 1080, height: 1920 });
    expect(nodeBounds(logo)).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
    // Le badge reste dans le coin bas droit.
    const b = nodeBounds(badge);
    expect(b.x + b.width).toBeCloseTo(1080);
    expect(b.y + b.height).toBeCloseTo(1920);
    // Le titre et le bandeau gardent leur écart, et le bloc garde sa place relative.
    expect(title.style.fontSize).toBe(48);
    expect(band.y - title.y).toBeCloseTo(200);
    expect((title.y + band.y + band.height) / 2).toBeCloseTo((560 / 1080) * 1920);
    // Le texte posé sur le bandeau le suit.
    expect(label.y - band.y).toBeCloseTo(30);
  });

  it('vers un format plus petit : tout est réduit dans les mêmes proportions', () => {
    const { ab, logo, title } = design();
    resizeArtboard(ab, 540, 540);
    expect(nodeBounds(logo)).toMatchObject({ x: 0, y: 0, width: 50, height: 50 });
    expect(title.style.fontSize).toBe(24);
  });
});

describe('palettes', () => {
  it('garde l’ordre des clartés et donc les contrastes', () => {
    const doc = createDocument({ width: 100, height: 100 });
    const ab = doc.artboards[0];
    ab.background = { type: 'solid', color: '#ffffff' };
    const text = createText({ x: 0, y: 0, width: 10, height: 10, text: 'a' });
    text.fill = { type: 'solid', color: '#111111' };
    const accent = createRect({ x: 0, y: 0, width: 10, height: 10 });
    accent.fill = { type: 'solid', color: '#ff000080' };
    ab.children.push(text, accent);
    expect(designColors({ artboard: ab, nodes: ab.children })).toEqual(['#111111', '#ff0000', '#ffffff']);
    applyPalette({ artboard: ab, nodes: ab.children }, ['#f4efe6', '#1b2a41', '#e07a5f', '#3d5a80']);
    expect(ab.background).toEqual({ type: 'solid', color: '#f4efe6' });
    expect(text.fill).toEqual({ type: 'solid', color: '#1b2a41' });
    // L'opacité de la couleur d'origine est conservée.
    expect((accent.fill as { color: string }).color.length).toBe(9);
    expect(contrastRatio('#1b2a41', '#f4efe6')).toBeGreaterThan(4.5);
  });
});
