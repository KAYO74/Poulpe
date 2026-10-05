import { describe, expect, it } from 'vitest';
import {
  applyBoolean,
  createDocument,
  createEllipse,
  createRect,
  exactBounds,
  fromSubpaths,
  insertAnchor,
  parseSvgPath,
  pathToSvg,
  toSubpaths,
  booleanCommands,
  offsetCommands,
  roundRectPath,
  importSvg,
  createLine,
  createText,
  createStar,
  artboardToSvg,
  defaultEffect,
  arrowPaths,
  shapePath,
  layoutTextOnPath,
  approximateMeasure,
  toPathNode,
} from '../src';

describe('tracés modifiables', () => {
  it('passent des commandes aux nœuds et retour', () => {
    const cmds = parseSvgPath('M0 0 C10 0 20 10 20 20 L0 20 Z');
    const sps = toSubpaths(cmds);
    expect(sps).toHaveLength(1);
    expect(sps[0].closed).toBe(true);
    expect(sps[0].anchors).toHaveLength(3);
    expect(pathToSvg(fromSubpaths(sps))).toBe(pathToSvg(cmds));
  });

  it('ajoutent un nœud sans changer la forme', () => {
    const cmds = parseSvgPath('M0 0 C0 50 100 50 100 0');
    const sps = toSubpaths(cmds);
    insertAnchor(sps, 0, 0, 0.5);
    expect(sps[0].anchors).toHaveLength(3);
    expect(sps[0].anchors[1].x).toBeCloseTo(50);
    expect(sps[0].anchors[1].y).toBeCloseTo(37.5);
    expect(exactBounds(fromSubpaths(sps))!.height).toBeCloseTo(37.5);
  });
});

describe('géométrie', () => {
  it('réunit deux carrés', () => {
    const r = booleanCommands(
      [{ cmds: roundRectPath(0, 0, 100, 100, 0) }, { cmds: roundRectPath(50, 50, 100, 100, 0) }],
      'unite',
    );
    expect(r).toHaveLength(1);
    expect(exactBounds(r[0].cmds)).toMatchObject({ x: 0, y: 0, width: 150, height: 150 });
  });

  it('divise deux carrés en trois morceaux', () => {
    const r = booleanCommands(
      [{ cmds: roundRectPath(0, 0, 100, 100, 0) }, { cmds: roundRectPath(50, 50, 100, 100, 0) }],
      'divide',
    );
    expect(r).toHaveLength(3);
  });

  it('remplace la sélection dans le document', () => {
    const doc = createDocument();
    const a = createRect({ x: 0, y: 0, width: 100, height: 100 });
    const b = createEllipse({ x: 50, y: 50, width: 100, height: 100 });
    doc.artboards[0].children.push(a, b);
    const ids = applyBoolean(doc, [a.id, b.id], 'subtract', 'Courbe');
    expect(ids).toHaveLength(1);
    expect(doc.artboards[0].children).toHaveLength(1);
    expect(doc.artboards[0].children[0]).toMatchObject({ type: 'path', x: 0, y: 0, width: 100, height: 100 });
  });

  it('décale un contour', () => {
    const out = offsetCommands(roundRectPath(0, 0, 100, 100, 0), 10);
    expect(exactBounds(out)).toMatchObject({ x: -10, y: -10, width: 120, height: 120 });
  });
});

describe('import SVG', () => {
  const svg = `<?xml version="1.0"?>
<!DOCTYPE svg>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 100 50">
  <style>.a{fill:#ff0000} #b { stroke: blue; stroke-width: 2 }</style>
  <defs><linearGradient id="g"><stop offset="0" stop-color="red"/><stop offset="1" stop-color="#00f" stop-opacity=".5"/></linearGradient></defs>
  <!-- commentaire -->
  <g transform="translate(10 0)" opacity="0.5">
    <rect class="a" x="0" y="0" width="10" height="10"/>
    <circle id="b" cx="30" cy="10" r="5" fill="none"/>
  </g>
  <path d="M0 40 L20 40 L10 30 Z" fill="url(#g)"/>
  <line x1="0" y1="0" x2="10" y2="0" stroke="black" stroke-dasharray="4 2"/>
  <text x="50" y="40" font-size="10" text-anchor="middle">Bonjour &amp; merci</text>
</svg>`;

  it('crée des objets modifiables à la bonne échelle', () => {
    const r = importSvg(svg)!;
    expect(r).not.toBeNull();
    expect(r.width).toBe(200);
    expect(r.height).toBe(100);
    const [g, tri, line, text] = r.nodes;
    expect(g).toMatchObject({ type: 'group', opacity: 0.5 });
    if (g.type !== 'group') throw new Error();
    const [rect, circle] = g.children;
    // viewBox 100×50 affiché en 200×100 : tout est doublé.
    expect(rect).toMatchObject({ type: 'path', x: 20, y: 0, width: 20, height: 20 });
    expect(rect.type === 'path' && rect.fill).toEqual({ type: 'solid', color: '#ff0000' });
    expect(circle.type === 'path' && circle.stroke).toMatchObject({
      width: 4,
      paint: { type: 'solid', color: '#0000ff' },
    });
    expect(circle.type === 'path' && circle.fill).toEqual({ type: 'none' });
    expect(tri.type === 'path' && tri.fill.type).toBe('linear');
    expect(line.type === 'path' && line.stroke.dash).toEqual([4, 2]);
    expect(text).toMatchObject({ type: 'text', text: 'Bonjour & merci' });
  });

  it('refuse ce qui n’est pas un SVG', () => {
    expect(importSvg('<html></html>')).toBeNull();
  });
});

describe('export SVG du v0.3', () => {
  it('écrit pointillés, flèches et effets', () => {
    const doc = createDocument({ width: 200, height: 200 });
    const line = createLine({ x: 10, y: 10, width: 100, height: 0 });
    line.stroke = {
      paint: { type: 'solid', color: '#000000' },
      width: 4,
      dash: [2, 1],
      cap: 'butt',
      end: 'triangle',
    };
    const rect = createRect({ x: 20, y: 20, width: 50, height: 50 });
    rect.effects = [defaultEffect('dropShadow'), defaultEffect('innerGlow')];
    doc.artboards[0].children.push(line, rect);
    const out = artboardToSvg(doc, doc.artboards[0]);
    expect(out).toContain('stroke-dasharray="8 4"');
    expect(out).toContain('stroke-linecap="butt"');
    expect(out).toContain('<filter');
    expect(out).toContain('feFuncA');
    expect(arrowPaths(shapePath(line), line.stroke).length).toBeGreaterThan(0);
  });
});

describe('texte sur tracé', () => {
  it('place les caractères le long de la courbe', () => {
    const t = createText({ x: 0, y: 0, width: 200, height: 0, text: 'abc' });
    t.path = { d: 'M0 0 L200 0', viewBox: { x: 0, y: 0, width: 200, height: 0 }, offset: 0 };
    const glyphs = layoutTextOnPath(t, approximateMeasure);
    expect(glyphs).toHaveLength(3);
    expect(glyphs[0].y).toBeCloseTo(0);
    expect(glyphs[1].x).toBeGreaterThan(glyphs[0].x);
  });
});

describe('conversion en courbes', () => {
  it('garde la place et le style', () => {
    const s = createStar({ x: 10, y: 10, width: 100, height: 100 });
    s.rotation = 30;
    const p = toPathNode(s)!;
    expect(p.type).toBe('path');
    expect(p.id).toBe(s.id);
    expect(p.rotation).toBe(30);
    // La boîte se resserre sur les pointes de l’étoile.
    expect(p.width).toBeCloseTo(95.1, 1);
  });
});
