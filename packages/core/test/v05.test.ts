import { describe, expect, it } from 'vitest';
import {
  approximateMeasure,
  arrangePages,
  artboardToSvg,
  chainHead,
  createDocument,
  createRect,
  createText,
  decodePoulpe,
  documentPages,
  duplicateArtboard,
  encodePoulpe,
  flowText,
  insertPage,
  migrate,
  mmToPx,
  movePage,
  pageFields,
  pageMargins,
  pageNumber,
  pxToPt,
  removeNodes,
  resolveFields,
  textChain,
  FORMAT_VERSION,
  type PoulpeDocument,
  type TextNode,
} from '../src';

/** Document de trois pages A4 à 300 ppp avec une page maître. */
function book(): PoulpeDocument {
  const doc = createDocument({ width: 2480, height: 3508 });
  doc.layout = { dpi: 300 };
  insertPage(doc, { name: 'Page 2' });
  insertPage(doc, { name: 'Page 3' });
  return doc;
}

function frame(text: string, x: number, y: number, h: number): TextNode {
  const t = createText({ x, y, width: 400, height: h, text, autoWidth: false });
  t.style = { ...t.style, fontSize: 20, lineHeight: 1 };
  t.frame = true;
  return t;
}

describe('pages', () => {
  it('se numérotent sans compter les pages maîtres', () => {
    const doc = book();
    const master = insertPage(doc, { name: 'A-Maître' });
    master.master = true;
    expect(documentPages(doc)).toHaveLength(3);
    expect(pageNumber(doc, doc.artboards[2])).toBe(3);
    expect(pageNumber(doc, master)).toBeNull();
    doc.layout!.firstNumber = 5;
    expect(pageFields(doc, doc.artboards[0])).toEqual({ page: '5', pages: '3' });
    expect(pageFields(doc, master)).toEqual({ page: '#', pages: '#' });
  });

  it('se rangent en colonne ou en doubles pages, avec leur contenu', () => {
    const doc = book();
    const r = createRect({ x: doc.artboards[2].x + 10, y: doc.artboards[2].y + 10, width: 50, height: 50 });
    doc.artboards[2].children.push(r);
    arrangePages(doc);
    const [p1, p2, p3] = doc.artboards;
    expect(p2.y).toBeGreaterThan(p1.y + p1.height);
    expect(r.x - p3.x).toBe(10);
    expect(r.y - p3.y).toBe(10);
    doc.layout!.facing = true;
    arrangePages(doc);
    // Page 1 seule à droite, puis 2 (gauche) et 3 (droite) côte à côte.
    expect(p2.y).toBe(p3.y);
    expect(p3.x).toBe(p2.x + p2.width);
    expect(p1.x).toBe(p3.x);
    expect(r.x - p3.x).toBe(10);
  });

  it('se déplacent, se dupliquent et suivent leurs marges en vis-à-vis', () => {
    const doc = book();
    const ids = doc.artboards.map((a) => a.id);
    movePage(doc, ids[2], 0);
    expect(doc.artboards.map((a) => a.id)).toEqual([ids[2], ids[0], ids[1]]);
    const t1 = frame('a', 0, 0, 100),
      t2 = frame('', 0, 200, 100);
    t1.next = t2.id;
    doc.artboards[0].children.push(t1, t2);
    const copy = duplicateArtboard(doc, ids[2], 'Copie')!;
    const [c1, c2] = copy.children as TextNode[];
    expect(c1.id).not.toBe(t1.id);
    expect(c1.next).toBe(c2.id);
    doc.layout = { facing: true, margins: { top: 1, bottom: 2, inside: 30, outside: 10 } };
    const p2 = documentPages(doc)[1];
    expect(pageMargins(doc, p2)).toEqual({ top: 1, bottom: 2, left: 10, right: 30 });
  });

  it('donnent leur taille réelle à partir de la résolution', () => {
    const doc = book();
    expect(Math.round(pxToPt(doc, 2480))).toBe(595);
    expect(Math.round(mmToPx(doc, 3))).toBe(35);
  });
});

describe('champs et cadres liés', () => {
  it('remplacent les champs en gardant les styles', () => {
    const t = createText({ x: 0, y: 0, width: 10, height: 10, text: 'p. {page}/{pages} fin' });
    t.runs = [{ start: 18, end: 21, style: { fontWeight: 700 } }];
    const r = resolveFields(t, { page: '12', pages: '40' });
    expect(r.text).toBe('p. 12/40 fin');
    expect(r.text.slice(r.runs![0].start, r.runs![0].end)).toBe('fin');
  });

  it('font couler le texte d’un cadre à l’autre', () => {
    const doc = createDocument();
    const a = frame('un deux trois quatre cinq six sept huit neuf dix', 0, 0, 40);
    const b = frame('', 0, 100, 40);
    const c = frame('', 0, 200, 40);
    a.width = b.width = c.width = 70;
    a.next = b.id;
    b.next = c.id;
    doc.artboards[0].children.push(a, b, c);
    expect(textChain(doc, c.id).map((n) => n.id)).toEqual([a.id, b.id, c.id]);
    expect(chainHead(doc, b.id)?.id).toBe(a.id);
    const flow = flowText(doc, b.id, approximateMeasure, null);
    expect(flow.parts.map((p) => p.layout.lines.length)).toEqual([2, 2, 2]);
    expect(flow.parts[1].start).toBe(flow.parts[0].end);
    expect(flow.parts[1].layout.lines[0].start).toBe(flow.parts[1].start);
    expect(flow.overflow).toBe(true);
    const joined = flow.parts.flatMap((p) => p.layout.lines.map((l) => l.text)).join(' ');
    expect(flow.text.startsWith(joined)).toBe(true);
    // L'export SVG montre la suite du texte dans le deuxième cadre.
    const svg = artboardToSvg(doc, doc.artboards[0]);
    expect(svg).toContain(flow.parts[1].layout.lines[0].text.split(' ')[0]);
  });

  it('referment la chaîne quand on supprime un cadre', () => {
    const doc = createDocument();
    const a = frame('texte', 0, 0, 40);
    const b = frame('', 0, 100, 40);
    const c = frame('', 0, 200, 40);
    a.next = b.id;
    b.next = c.id;
    doc.artboards[0].children.push(a, b, c);
    removeNodes(doc, [b.id]);
    expect(a.next).toBe(c.id);
    removeNodes(doc, [a.id]);
    expect(c.text).toBe('texte');
    expect(c.next).toBeUndefined();
  });
});

describe('format v4', () => {
  it('garde pages maîtres, cadres et réglages', () => {
    const doc = book();
    doc.layout = { dpi: 300, bleed: 35, facing: true, margins: { top: 1, bottom: 1, inside: 1, outside: 1 } };
    doc.artboards[0].master = true;
    doc.artboards[1].masterId = doc.artboards[0].id;
    const back = decodePoulpe(encodePoulpe(doc));
    expect(back.version).toBe(FORMAT_VERSION);
    expect(back.layout).toEqual(doc.layout);
    expect(back.artboards[1].masterId).toBe(doc.artboards[0].id);
  });

  it('ouvre les documents des versions précédentes', () => {
    const old = { ...createDocument(), version: 3 } as unknown as Record<string, unknown>;
    expect(migrate(old).version).toBe(FORMAT_VERSION);
  });

  it('montre la page maître sous la page dans le SVG', () => {
    const doc = createDocument({ width: 100, height: 100 });
    const master = insertPage(doc, { name: 'A-Maître' });
    master.master = true;
    const num = createText({ x: master.x + 5, y: master.y + 5, width: 50, height: 20, text: 'Page {page}' });
    master.children.push(num);
    doc.artboards[0].masterId = master.id;
    const svg = artboardToSvg(doc, doc.artboards[0], { bleed: 10 });
    expect(svg).toContain('Page 1');
    expect(svg).toContain('viewBox="-10 -10 120 120"');
    expect(artboardToSvg(doc, master)).toContain('Page #');
  });
});

describe('numéro de page centré', () => {
  it('reste centré dans sa boîte quand le champ est remplacé', () => {
    const doc = createDocument();
    const t = createText({ x: 0, y: 0, width: 200, height: 20, text: '{page}', autoWidth: true });
    t.style = { ...t.style, align: 'center' };
    doc.artboards[0].children.push(t);
    const [part] = flowText(doc, t.id, approximateMeasure, { page: '7', pages: '9' }).parts;
    const line = part.layout.lines[0];
    expect(line.offset + line.width / 2).toBeCloseTo(100, 5);
  });
});
