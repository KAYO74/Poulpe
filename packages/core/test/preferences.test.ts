import { describe, expect, it } from 'vitest';
import { Editor, createDocument } from '../src';

function rename(ed: Editor, n: number) {
  ed.apply('history.rename', (d) => {
    d.name = `Doc ${n}`;
  });
}

describe('limite de l’historique', () => {
  it('oublie les plus anciennes étapes', () => {
    const ed = new Editor(createDocument());
    ed.setHistoryLimit(3);
    for (let i = 1; i <= 6; i++) rename(ed, i);
    expect(ed.getState().historyIndex).toBe(3);
    ed.undo();
    ed.undo();
    ed.undo();
    expect(ed.doc.name).toBe('Doc 3');
    expect(ed.getState().canUndo).toBe(false);
  });

  it('coupe tout de suite quand la limite baisse, et 0 la rend illimitée', () => {
    const ed = new Editor(createDocument());
    for (let i = 1; i <= 10; i++) rename(ed, i);
    ed.setHistoryLimit(4);
    expect(ed.getState().historyIndex).toBe(4);
    ed.setHistoryLimit(0);
    for (let i = 11; i <= 20; i++) rename(ed, i);
    expect(ed.getState().historyIndex).toBe(14);
  });

  it('dropOldHistory libère des étapes en cas de manque de mémoire', () => {
    const ed = new Editor(createDocument());
    for (let i = 1; i <= 8; i++) rename(ed, i);
    ed.dropOldHistory(2);
    expect(ed.getState().historyIndex).toBe(2);
  });

  it('snapshot et restore remettent document et historique', () => {
    const ed = new Editor(createDocument({ name: 'A' }));
    rename(ed, 1);
    rename(ed, 2);
    ed.undo();
    const snap = ed.snapshot();
    ed.load(createDocument({ name: 'Essai' }));
    expect(ed.getState().canUndo).toBe(false);
    ed.restore(snap);
    expect(ed.doc.name).toBe('Doc 1');
    expect(ed.getState().canRedo).toBe(true);
    expect(ed.getState().dirty).toBe(true);
    ed.undo();
    expect(ed.doc.name).toBe('A');
    expect(ed.getState().dirty).toBe(false);
  });
});
