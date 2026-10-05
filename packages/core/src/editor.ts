import { produce, freeze, setAutoFreeze } from 'immer';
import { createDocument } from './factory';
import { allNodeIds, findNode, fitGroups } from './tree';
import type { PoulpeDocument } from './types';

setAutoFreeze(true);

export interface HistoryEntry {
  /** Clé de traduction décrivant l'action, par ex. `history.move`. */
  label: string;
  doc: PoulpeDocument;
  selection: string[];
  /** État hors document gardé avec l'historique (la sélection de pixels de l'interface). */
  extra?: unknown;
}

/** Lecture et restauration d'un état hors document qui suit l'historique (voir `setExtraState`). */
export interface ExtraState {
  get(): unknown;
  set(value: unknown): void;
}

export interface EditorState {
  doc: PoulpeDocument;
  selection: string[];
  /** Plan de travail actif : celui où arrivent les nouveaux objets quand on ne vise aucun plan. */
  activeArtboardId: string;
  /** Vrai si le document a changé depuis le dernier enregistrement. */
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Libellés de l'historique, du plus ancien au plus récent ; `historyIndex` pointe l'état courant. */
  history: string[];
  historyIndex: number;
}

type Recipe = (draft: PoulpeDocument) => void | string[];

/**
 * Le cœur de l'éditeur : tout changement passe par une commande (`apply`) ou par un geste
 * (`begin` / `preview` / `commit`), ce qui rend l'annulation fiable. Les documents sont immuables
 * (immer) : l'historique, illimité, ne garde que des références, pas des copies.
 */
export class Editor {
  private past: HistoryEntry[] = [];
  private future: HistoryEntry[] = [];
  private gesture: { base: PoulpeDocument; selection: string[] } | null = null;
  private savedDoc: PoulpeDocument | null;
  private listeners = new Set<() => void>();
  private state: EditorState;
  private currentLabel = 'history.open';
  /**
   * Passe exécutée après chaque commande, dans le même brouillon : l'interface s'en sert pour
   * recalculer la taille des textes, qui dépend des polices du navigateur.
   */
  private normalizer: ((draft: PoulpeDocument) => void) | null = null;
  private extra: ExtraState | null = null;

  constructor(doc: PoulpeDocument = createDocument()) {
    const frozen = freeze(doc, true);
    this.savedDoc = frozen;
    this.state = this.makeState(frozen, [], doc.artboards[0]?.id ?? '');
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getState = (): EditorState => this.state;

  get doc(): PoulpeDocument {
    return this.state.doc;
  }

  get selection(): string[] {
    return this.state.selection;
  }

  private makeState(doc: PoulpeDocument, selection: string[], activeArtboardId: string): EditorState {
    const active = doc.artboards.some((a) => a.id === activeArtboardId)
      ? activeArtboardId
      : (doc.artboards[0]?.id ?? '');
    return {
      doc,
      selection,
      activeArtboardId: active,
      dirty: doc !== this.savedDoc,
      canUndo: this.past.length > 0,
      canRedo: this.future.length > 0,
      history: [
        ...this.past.map((e) => e.label),
        this.currentLabel,
        ...[...this.future].reverse().map((e) => e.label),
      ],
      historyIndex: this.past.length,
    };
  }

  private set(doc: PoulpeDocument, selection: string[], activeArtboardId = this.state.activeArtboardId) {
    const valid = new Set(allNodeIds(doc));
    this.state = this.makeState(
      doc,
      selection.filter((id) => valid.has(id)),
      activeArtboardId,
    );
    this.listeners.forEach((l) => l());
  }

  private run(base: PoulpeDocument, recipe: Recipe): { doc: PoulpeDocument; selection?: string[] } {
    let selection: string[] | undefined;
    const doc = produce(base, (draft) => {
      const r = recipe(draft);
      if (Array.isArray(r)) selection = r;
      this.normalizer?.(draft);
      fitGroups(draft);
    });
    return { doc, selection };
  }

  /**
   * Applique une commande annulable. La recette modifie le brouillon ; si elle renvoie
   * une liste d'ids, celle-ci devient la nouvelle sélection.
   */
  apply(label: string, recipe: Recipe): void {
    if (this.gesture) this.commit(label);
    const { doc, selection } = this.run(this.state.doc, recipe);
    if (doc === this.state.doc && !selection) return;
    if (doc !== this.state.doc) this.push(label);
    this.set(doc, selection ?? this.state.selection);
  }

  private push(label: string) {
    this.past.push({
      label: this.currentLabel,
      doc: this.state.doc,
      selection: this.state.selection,
      extra: this.extra?.get(),
    });
    this.future = [];
    this.currentLabel = label;
  }

  /** Début d'un geste (glisser, redimensionner…) : les aperçus partent tous de cet état. */
  begin(): void {
    this.gesture = { base: this.state.doc, selection: this.state.selection };
  }

  get inGesture(): boolean {
    return this.gesture !== null;
  }

  /** Aperçu pendant un geste, sans entrée d'historique. */
  preview(recipe: Recipe): void {
    if (!this.gesture) this.begin();
    const { doc, selection } = this.run(this.gesture!.base, recipe);
    this.set(doc, selection ?? this.state.selection);
  }

  /** Fin du geste : une seule entrée d'historique pour tout le geste. */
  commit(label: string): void {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;
    if (this.state.doc === g.base) return;
    this.past.push({
      label: this.currentLabel,
      doc: g.base,
      selection: g.selection,
      extra: this.extra?.get(),
    });
    this.future = [];
    this.currentLabel = label;
    this.set(this.state.doc, this.state.selection);
  }

  cancel(): void {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;
    this.set(g.base, g.selection);
  }

  undo(): void {
    if (this.gesture) this.cancel();
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push({
      label: this.currentLabel,
      doc: this.state.doc,
      selection: this.state.selection,
      extra: this.extra?.get(),
    });
    this.currentLabel = prev.label;
    this.extra?.set(prev.extra);
    this.set(prev.doc, prev.selection);
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push({
      label: this.currentLabel,
      doc: this.state.doc,
      selection: this.state.selection,
      extra: this.extra?.get(),
    });
    this.currentLabel = next.label;
    this.extra?.set(next.extra);
    this.set(next.doc, next.selection);
  }

  /** Revient à un point de l'historique (panneau Historique). */
  goTo(index: number): void {
    while (this.past.length > index && this.past.length) this.undo();
    while (this.past.length < index && this.future.length) this.redo();
  }

  /**
   * État hors document qui suit l'historique : `get` est lu à chaque étape enregistrée, `set`
   * le restaure à l'annulation et au rétablissement.
   */
  setExtraState(extra: ExtraState | null): void {
    this.extra = extra;
  }

  /**
   * Enregistre une étape d'historique qui ne change que l'état hors document (une nouvelle
   * sélection de pixels, par exemple). `before` : cet état juste avant le changement.
   */
  mark(label: string, before: unknown): void {
    if (this.gesture) this.commit(label);
    this.past.push({
      label: this.currentLabel,
      doc: this.state.doc,
      selection: this.state.selection,
      extra: before,
    });
    this.future = [];
    this.currentLabel = label;
    this.set(this.state.doc, this.state.selection);
  }

  select(ids: string[]): void {
    const doc = this.state.doc;
    const first = ids.length ? findNode(doc, ids[0]) : null;
    this.set(doc, ids, first?.artboard.id ?? this.state.activeArtboardId);
  }

  setActiveArtboard(id: string): void {
    this.set(this.state.doc, this.state.selection, id);
  }

  /**
   * Remplace le document (ouverture d'un fichier) et vide l'historique. `unsaved` : le document
   * n'existe pas sur le disque tel quel (brouillon récupéré).
   */
  load(doc: PoulpeDocument, opts: { unsaved?: boolean } = {}): void {
    this.past = [];
    this.future = [];
    this.gesture = null;
    this.currentLabel = 'history.open';
    const frozen = freeze(doc, true);
    this.savedDoc = opts.unsaved ? null : frozen;
    this.set(frozen, [], frozen.artboards[0]?.id ?? '');
    this.normalizeNow();
  }

  setNormalizer(fn: ((draft: PoulpeDocument) => void) | null): void {
    this.normalizer = fn;
    this.normalizeNow();
  }

  /**
   * Réapplique la normalisation au document courant sans créer d'entrée d'historique
   * (par exemple quand une police finit de charger et que les textes changent de taille).
   */
  normalizeNow(): void {
    if (!this.normalizer) return;
    const base = this.state.doc;
    const doc = produce(base, (draft) => {
      this.normalizer!(draft);
      fitGroups(draft);
    });
    if (doc === base) return;
    if (base === this.savedDoc) this.savedDoc = doc;
    if (this.gesture) this.gesture.base = produce(this.gesture.base, (d) => void this.normalizer!(d));
    this.set(doc, this.state.selection);
  }

  markSaved(): void {
    this.savedDoc = this.state.doc;
    this.set(this.state.doc, this.state.selection);
  }
}
