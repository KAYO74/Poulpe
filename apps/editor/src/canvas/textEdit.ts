import { findArtboard, findNode, removeNodes, type TextNode } from '@poulpe/core';
import { editor, ui } from '../store';

/*
 * Session d'édition d'un texte. Toute la saisie forme un seul geste annulable ;
 * un nouveau texte resté vide est abandonné, un texte existant vidé est supprimé.
 */

interface Session {
  id: string;
  isNew: boolean;
  node?: TextNode;
  artboardId?: string;
}

let session: Session | null = null;

export function beginTextEdit(id: string, isNew: boolean, node?: TextNode, artboardId?: string): void {
  if (session) endTextEdit();
  session = { id, isNew, node, artboardId };
  editor.begin();
  if (isNew && node) setEditedText('');
  editor.select([id]);
  ui.set({ editingTextId: id });
}

export function setEditedText(text: string): void {
  const s = session;
  if (!s) return;
  editor.preview((d) => {
    let n = findNode(d, s.id)?.node;
    if (!n && s.node && s.artboardId) {
      const ab = findArtboard(d, s.artboardId) ?? d.artboards[0];
      ab.children.push({ ...s.node, text });
      n = ab.children[ab.children.length - 1];
    }
    if (n?.type === 'text') n.text = text;
    return [s.id];
  });
}

export function currentEditedText(): string {
  const s = session;
  if (!s) return '';
  const n = findNode(editor.doc, s.id)?.node;
  return n?.type === 'text' ? n.text : '';
}

export function endTextEdit(): void {
  const s = session;
  if (!s) return;
  session = null;
  ui.set({ editingTextId: null });
  const n = findNode(editor.doc, s.id)?.node;
  const empty = !n || (n.type === 'text' && !n.text.trim());
  if (empty) {
    if (s.isNew) editor.cancel();
    else {
      editor.preview((d) => {
        removeNodes(d, [s.id]);
        return [];
      });
      editor.commit('history.delete');
    }
    return;
  }
  editor.commit(s.isNew ? 'history.add' : 'history.text');
}

export function isEditingText(): boolean {
  return session !== null;
}
