import { describe, expect, it } from 'vitest';
import {
  Editor,
  createDocument,
  createGroup,
  createRect,
  decodePoulpe,
  encodePoulpe,
  groupNodes,
  moveNodesTo,
  reorderNodes,
  type PoulpeDocument,
} from '../src';

const rect = (name: string) => Object.assign(createRect({ x: 0, y: 0, width: 10, height: 10 }), { name });

function docWith(...names: string[]): PoulpeDocument {
  const doc = createDocument();
  doc.artboards[0].children = names.map(rect);
  return doc;
}

const names = (doc: PoulpeDocument) => doc.artboards[0].children.map((n) => n.name);
const id = (doc: PoulpeDocument, name: string) => doc.artboards[0].children.find((n) => n.name === name)!.id;

describe('ordre des calques', () => {
  it('premier plan, avancer, reculer, arrière-plan', () => {
    const doc = docWith('a', 'b', 'c', 'd');
    reorderNodes(doc, [id(doc, 'a')], 'front');
    expect(names(doc)).toEqual(['b', 'c', 'd', 'a']);
    reorderNodes(doc, [id(doc, 'a')], 'backward');
    expect(names(doc)).toEqual(['b', 'c', 'a', 'd']);
    reorderNodes(doc, [id(doc, 'a')], 'back');
    expect(names(doc)).toEqual(['a', 'b', 'c', 'd']);
    reorderNodes(doc, [id(doc, 'a')], 'forward');
    expect(names(doc)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('déplace plusieurs calques ensemble en gardant leur ordre', () => {
    const doc = docWith('a', 'b', 'c', 'd', 'e');
    reorderNodes(doc, [id(doc, 'a'), id(doc, 'c')], 'front');
    expect(names(doc)).toEqual(['b', 'd', 'e', 'a', 'c']);
    reorderNodes(doc, [id(doc, 'a'), id(doc, 'c')], 'backward');
    expect(names(doc)).toEqual(['b', 'd', 'a', 'c', 'e']);
  });

  it('glisse plusieurs calques à une position intermédiaire', () => {
    const doc = docWith('a', 'b', 'c', 'd', 'e');
    const ab = doc.artboards[0].id;
    // Sélection donnée dans le désordre : l'ordre d'empilement est gardé.
    moveNodesTo(doc, [id(doc, 'e'), id(doc, 'a')], ab, 3);
    expect(names(doc)).toEqual(['b', 'c', 'a', 'e', 'd']);
    moveNodesTo(doc, [id(doc, 'b')], ab, 5);
    expect(names(doc)).toEqual(['c', 'a', 'e', 'd', 'b']);
  });

  it('glisse dans un groupe, mais pas un groupe dans lui-même', () => {
    const doc = docWith('a', 'b', 'c');
    const g = Object.assign(createGroup([]), { name: 'g' });
    groupNodes(doc, [id(doc, 'a'), id(doc, 'b')], g);
    moveNodesTo(doc, [id(doc, 'c')], g.id, 1);
    expect(names(doc)).toEqual(['g']);
    const group = doc.artboards[0].children[0] as typeof g;
    expect(group.children.map((n) => n.name)).toEqual(['a', 'c', 'b']);
    expect(moveNodesTo(doc, [g.id], g.id, 0)).toBe(false);
    expect(moveNodesTo(doc, [g.id], group.children[0].id, 0)).toBe(false);
  });

  it('annule et rétablit un changement d’ordre', () => {
    const ed = new Editor(docWith('a', 'b', 'c'));
    const a = id(ed.doc, 'a');
    ed.apply('ordre', (d) => void reorderNodes(d, [a], 'front'));
    expect(names(ed.doc)).toEqual(['b', 'c', 'a']);
    ed.undo();
    expect(names(ed.doc)).toEqual(['a', 'b', 'c']);
    ed.redo();
    expect(names(ed.doc)).toEqual(['b', 'c', 'a']);
  });

  it('garde l’ordre après enregistrement et réouverture', () => {
    const doc = docWith('a', 'b', 'c', 'd');
    moveNodesTo(doc, [id(doc, 'd')], doc.artboards[0].id, 0);
    reorderNodes(doc, [id(doc, 'b')], 'front');
    const back = decodePoulpe(encodePoulpe(doc));
    expect(names(back)).toEqual(['d', 'a', 'c', 'b']);
  });

  it('reste rapide avec des milliers de calques', () => {
    const doc = docWith(...Array.from({ length: 5000 }, (_, i) => `n${i}`));
    const ids = doc.artboards[0].children.filter((_, i) => i % 10 === 0).map((n) => n.id);
    const t0 = performance.now();
    reorderNodes(doc, ids, 'front');
    moveNodesTo(doc, ids, doc.artboards[0].id, 0);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(doc.artboards[0].children.slice(0, 500).map((n) => n.id)).toEqual(ids);
  });
});
