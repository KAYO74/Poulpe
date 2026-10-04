import { describe, expect, it } from 'vitest';
import {
  Editor,
  alignNodes,
  artboardToSvg,
  createDocument,
  createEllipse,
  createImage,
  createRect,
  createText,
  decodePoulpe,
  distributeNodes,
  encodePoulpe,
  findNode,
  groupNodes,
  createGroup,
  hitNode,
  layoutText,
  approximateMeasure,
  nodeBounds,
  normalizeHex,
  parseColor,
  formatColor,
  reorderNodes,
  rgbToHsv,
  hsvToRgb,
  rotateNode,
  ungroupNode,
  PoulpeFileError,
  sampleStops,
  type PoulpeDocument,
} from '../src';
import { strToU8, zipSync } from 'fflate';

function docWith(...nodes: ReturnType<typeof createRect>[]): PoulpeDocument {
  const doc = createDocument();
  doc.artboards[0].children.push(...nodes);
  return doc;
}

describe('couleurs', () => {
  it('lit et écrit les couleurs hexadécimales', () => {
    expect(parseColor('#ff8000')).toEqual({ r: 255, g: 128, b: 0, a: 1 });
    expect(formatColor({ r: 255, g: 128, b: 0, a: 0.5 })).toBe('#ff800080');
    expect(normalizeHex('F00')).toBe('#ff0000');
    expect(normalizeHex('zz')).toBeNull();
  });
  it('fait l’aller-retour RVB ↔ TSV', () => {
    const c = { r: 43, g: 165, b: 154, a: 1 };
    const back = hsvToRgb(rgbToHsv(c));
    expect(Math.round(back.r)).toBe(43);
    expect(Math.round(back.g)).toBe(165);
    expect(Math.round(back.b)).toBe(154);
  });
  it('interpole un dégradé', () => {
    expect(
      sampleStops(
        [
          { offset: 0, color: '#000000' },
          { offset: 1, color: '#ffffff' },
        ],
        0.5,
      ),
    ).toBe('#808080');
  });
});

describe('géométrie', () => {
  it('calcule la boîte d’un objet tourné', () => {
    const r = createRect({ x: 0, y: 0, width: 100, height: 20 });
    rotateNode(r, 90, { x: 50, y: 10 });
    const b = nodeBounds(r);
    expect(b.width).toBeCloseTo(20);
    expect(b.height).toBeCloseTo(100);
  });
  it('touche une ellipse seulement à l’intérieur', () => {
    const e = createEllipse({ x: 0, y: 0, width: 100, height: 100 });
    expect(hitNode(e, { x: 50, y: 50 })).toBe(true);
    expect(hitNode(e, { x: 2, y: 2 })).toBe(false);
  });
});

describe('arbre du document', () => {
  it('groupe et dégroupe en gardant l’ordre', () => {
    const a = createRect({ x: 0, y: 0, width: 10, height: 10 });
    const b = createRect({ x: 20, y: 0, width: 10, height: 10 });
    const c = createRect({ x: 40, y: 0, width: 10, height: 10 });
    const doc = docWith(a, b, c);
    const g = createGroup([]);
    groupNodes(doc, [a.id, b.id], g);
    const kids = doc.artboards[0].children;
    expect(kids.map((k) => k.id)).toEqual([g.id, c.id]);
    expect(g.children.map((k) => k.id)).toEqual([a.id, b.id]);
    expect(nodeBounds(g)).toEqual({ x: 0, y: 0, width: 30, height: 10 });
    ungroupNode(doc, g.id);
    expect(doc.artboards[0].children.map((k) => k.id)).toEqual([a.id, b.id, c.id]);
  });
  it('change l’ordre d’empilement', () => {
    const a = createRect({ x: 0, y: 0, width: 10, height: 10 });
    const b = createRect({ x: 0, y: 0, width: 10, height: 10 });
    const c = createRect({ x: 0, y: 0, width: 10, height: 10 });
    const doc = docWith(a, b, c);
    reorderNodes(doc, [a.id], 'front');
    expect(doc.artboards[0].children.map((k) => k.id)).toEqual([b.id, c.id, a.id]);
    reorderNodes(doc, [a.id], 'backward');
    expect(doc.artboards[0].children.map((k) => k.id)).toEqual([b.id, a.id, c.id]);
  });
  it('aligne et répartit', () => {
    const a = createRect({ x: 0, y: 0, width: 10, height: 10 });
    const b = createRect({ x: 50, y: 30, width: 10, height: 10 });
    const c = createRect({ x: 100, y: 60, width: 10, height: 10 });
    const doc = docWith(a, b, c);
    alignNodes(doc, [a.id, b.id, c.id], 'top');
    expect([a, b, c].map((n) => findNode(doc, n.id)!.node.y)).toEqual([0, 0, 0]);
    findNode(doc, b.id)!.node.x = 20;
    distributeNodes(doc, [a.id, b.id, c.id], 'h');
    expect(findNode(doc, b.id)!.node.x).toBeCloseTo(50);
  });
});

describe('éditeur et historique', () => {
  it('annule et rétablit une commande', () => {
    const ed = new Editor(createDocument());
    const ab = ed.doc.artboards[0].id;
    const r = createRect({ x: 0, y: 0, width: 10, height: 10 });
    ed.apply('history.add', (d) => {
      d.artboards.find((a) => a.id === ab)!.children.push(r);
      return [r.id];
    });
    expect(ed.selection).toEqual([r.id]);
    expect(ed.getState().dirty).toBe(true);
    ed.undo();
    expect(ed.doc.artboards[0].children).toHaveLength(0);
    expect(ed.selection).toEqual([]);
    ed.redo();
    expect(ed.doc.artboards[0].children).toHaveLength(1);
  });
  it('fusionne un geste en une seule entrée', () => {
    const r = createRect({ x: 0, y: 0, width: 10, height: 10 });
    const ed = new Editor(docWith(r));
    ed.begin();
    for (let i = 1; i <= 5; i++) ed.preview((d) => void (findNode(d, r.id)!.node.x = i * 10));
    ed.commit('history.move');
    expect(findNode(ed.doc, r.id)!.node.x).toBe(50);
    expect(ed.getState().history).toEqual(['history.open', 'history.move']);
    ed.undo();
    expect(findNode(ed.doc, r.id)!.node.x).toBe(0);
  });
  it('garde les anciens états intacts', () => {
    const r = createRect({ x: 0, y: 0, width: 10, height: 10 });
    const ed = new Editor(docWith(r));
    const before = ed.doc;
    ed.apply('history.move', (d) => void (findNode(d, r.id)!.node.x = 99));
    expect(findNode(before, r.id)!.node.x).toBe(0);
  });
});

describe('texte', () => {
  it('passe à la ligne dans un bloc de texte', () => {
    const t = createText({
      x: 0,
      y: 0,
      width: 200,
      height: 10,
      text: 'un deux trois quatre cinq six',
      autoWidth: false,
    });
    t.style.fontSize = 20;
    const layout = layoutText(t, approximateMeasure);
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.every((l) => l.width <= 200)).toBe(true);
  });
});

describe('export SVG', () => {
  it('produit un SVG avec dégradé, texte et image', () => {
    const doc = createDocument();
    const r = createRect({ x: 10, y: 10, width: 100, height: 50 });
    r.fill = {
      type: 'linear',
      angle: 0,
      stops: [
        { offset: 0, color: '#ff0000' },
        { offset: 1, color: '#0000ff80' },
      ],
    };
    const t = createText({ x: 0, y: 100, width: 100, height: 40, text: 'Bonjour <monde>' });
    doc.assets.img = {
      id: 'img',
      mime: 'image/png',
      width: 1,
      height: 1,
      data: 'data:image/png;base64,iVBORw0KGgo=',
    };
    const i = createImage({ x: 0, y: 0, width: 10, height: 10, assetId: 'img' });
    doc.artboards[0].children.push(r, t, i);
    const svg = artboardToSvg(doc, doc.artboards[0]);
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('stop-opacity="0.502"');
    expect(svg).toContain('Bonjour &lt;monde&gt;');
    expect(svg).toContain('href="data:image/png;base64');
    expect(svg.startsWith('<svg')).toBe(true);
  });
});

describe('fichier .poulpe', () => {
  it('fait l’aller-retour avec les images', () => {
    const doc = createDocument({ name: 'Affiche' });
    doc.assets.img = {
      id: 'img',
      mime: 'image/png',
      width: 1,
      height: 1,
      data: 'data:image/png;base64,iVBORw0KGgo=',
    };
    doc.artboards[0].children.push(createImage({ x: 0, y: 0, width: 10, height: 10, assetId: 'img' }));
    const bytes = encodePoulpe(doc);
    const back = decodePoulpe(bytes);
    expect(back).toEqual(doc);
  });
  it('refuse un fichier trop récent ou invalide', () => {
    const future = zipSync({
      'document.json': strToU8(JSON.stringify({ format: 'poulpe', version: 999, artboards: [] })),
    });
    expect(() => decodePoulpe(future)).toThrowError(PoulpeFileError);
    try {
      decodePoulpe(future);
    } catch (e) {
      expect((e as PoulpeFileError).code).toBe('tooNew');
    }
    expect(() => decodePoulpe(new Uint8Array([1, 2, 3]))).toThrowError(PoulpeFileError);
  });
});
