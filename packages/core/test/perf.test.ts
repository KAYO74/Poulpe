import { describe, expect, it } from 'vitest';
import { Editor, createDocument, createRect, defaultStyle } from '../src';

describe("limite de l'historique", () => {
  const addRects = (ed: Editor, n: number) => {
    for (let i = 0; i < n; i++)
      ed.apply('history.add', (d) => {
        d.artboards[0].children.push(createRect({ x: i, y: 0, width: 10, height: 10 }, defaultStyle()));
      });
  };

  it('oublie les étapes les plus anciennes au-delà de la limite', () => {
    const ed = new Editor(createDocument());
    ed.setHistoryLimit(5);
    addRects(ed, 8);
    expect(ed.getState().historyIndex).toBe(5);
    expect(ed.getState().history).toHaveLength(6);
    for (let i = 0; i < 10; i++) ed.undo();
    // Seules les 5 dernières étapes s'annulent : 3 rectangles restent.
    expect(ed.doc.artboards[0].children).toHaveLength(3);
    expect(ed.getState().canUndo).toBe(false);
    for (let i = 0; i < 10; i++) ed.redo();
    expect(ed.doc.artboards[0].children).toHaveLength(8);
  });

  it("réduire la limite raccourcit l'historique existant ; 0 le rend illimité", () => {
    const ed = new Editor(createDocument());
    addRects(ed, 12);
    expect(ed.getState().historyIndex).toBe(12);
    ed.setHistoryLimit(4);
    expect(ed.getState().historyIndex).toBe(4);
    ed.setHistoryLimit(0);
    addRects(ed, 10);
    expect(ed.getState().historyIndex).toBe(14);
  });

  it('garde la même liste de libellés pendant un geste', () => {
    const ed = new Editor(createDocument());
    addRects(ed, 3);
    ed.begin();
    ed.preview((d) => void (d.artboards[0].children[0].x = 50));
    const labels = ed.getState().history;
    ed.preview((d) => void (d.artboards[0].children[0].x = 60));
    expect(ed.getState().history).toBe(labels);
    ed.commit('history.move');
    expect(ed.getState().history).not.toBe(labels);
    expect(ed.getState().history.at(-1)).toBe('history.move');
  });
});
