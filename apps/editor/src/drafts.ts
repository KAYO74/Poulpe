import type { PoulpeDocument } from '@poulpe/core';
import { editor, ui } from './store';

/*
 * Brouillons : le document non enregistré est copié dans IndexedDB peu après chaque
 * modification. Si la fenêtre se ferme sans enregistrer, Poulpe propose de le rouvrir au
 * prochain lancement. Le brouillon est effacé dès que le document est enregistré ou abandonné.
 */

export interface Draft {
  doc: PoulpeDocument;
  filePath: string | null;
  savedAt: number;
}

const DB = 'poulpe';
const STORE = 'drafts';
const KEY = 'current';
const DELAY = 1500;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function readDraft(): Promise<Draft | null> {
  try {
    return ((await run('readonly', (s) => s.get(KEY))) as Draft | undefined) ?? null;
  } catch {
    return null;
  }
}

async function writeDraft(draft: Draft): Promise<void> {
  try {
    await run('readwrite', (s) => s.put(draft, KEY));
  } catch {
    /* stockage indisponible (navigation privée, quota) : pas de brouillon */
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(KEY));
  } catch {
    /* rien à effacer */
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
let lastDoc: PoulpeDocument | null = null;
let paused = true;

function schedule(): void {
  if (paused) return;
  const { doc, dirty } = editor.getState();
  if (doc === lastDoc) return;
  lastDoc = doc;
  clearTimeout(timer);
  if (!dirty) {
    void clearDraft();
    return;
  }
  timer = setTimeout(() => {
    const state = editor.getState();
    if (!state.dirty) return;
    void writeDraft({ doc: state.doc, filePath: ui.get().filePath, savedAt: Date.now() });
  }, DELAY);
}

/**
 * Démarre l'enregistrement des brouillons. Un brouillon laissé par une session précédente est
 * d'abord proposé à l'utilisateur ; on n'écrit rien avant sa réponse pour ne pas l'écraser.
 */
export async function startDrafts(): Promise<void> {
  editor.subscribe(schedule);
  const draft = await readDraft();
  if (draft?.doc?.artboards) {
    pendingDraft = draft;
    ui.set({ dialog: 'draft' });
  } else resumeDrafts();
}

let pendingDraft: Draft | null = null;

export function getPendingDraft(): Draft | null {
  return pendingDraft;
}

function resumeDrafts(): void {
  paused = false;
  lastDoc = null;
  schedule();
}

export function restoreDraft(): void {
  const d = pendingDraft;
  pendingDraft = null;
  if (d) {
    editor.load(d.doc, { unsaved: true });
    ui.set({ filePath: d.filePath });
    requestAnimationFrame(() => window.dispatchEvent(new Event('poulpe:fit')));
  }
  ui.set({ dialog: null });
  resumeDrafts();
}

export function discardDraft(): void {
  pendingDraft = null;
  ui.set({ dialog: null });
  void clearDraft().then(resumeDrafts);
}
