import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { t } from './i18n';
import {
  Editor,
  createDocument,
  defaultStyle,
  type Defaults,
  type PoulpeDocument,
  type EditorState,
} from '@poulpe/core';

export type ToolId =
  | 'select'
  | 'direct'
  | 'artboard'
  | 'pen'
  | 'pencil'
  | 'rect'
  | 'ellipse'
  | 'polygon'
  | 'star'
  | 'line'
  | 'text'
  | 'image'
  | 'hand'
  | 'zoom'
  | 'eyedropper';

export type Side = 'left' | 'right';
export type Theme = 'dark' | 'light';
export type Dialog =
  null | 'new' | 'export' | 'shortcuts' | 'about' | 'draft' | 'resize' | 'offset' | 'document';

/** Personas, comme dans Affinity : chacune a ses outils et ses panneaux. */
export type Persona = 'draw' | 'layout';

export interface Settings {
  theme: Theme;
  toolsSide: Side;
  studioSide: Side;
  rulers: boolean;
  grid: boolean;
  snapping: boolean;
  /** Panneau Bibliothèque (modèles, éléments, styles) ouvert. */
  library: boolean;
  /** Afficher l'écran d'accueil (nouveau document, modèles) au lancement. */
  showWelcome: boolean;
}

export interface View {
  zoom: number;
  /** Position à l'écran (pixels CSS) de l'origine du document. */
  panX: number;
  panY: number;
}

export interface UiState {
  persona: Persona;
  tool: ToolId;
  view: View;
  settings: Settings;
  /** Style appliqué aux nouveaux objets. */
  defaults: Defaults & { cornerRadius: number; sides: number; points: number; innerRatio: number };
  /** Cible des panneaux de couleur. */
  colorTarget: 'fill' | 'stroke';
  recentColors: string[];
  editingTextId: string | null;
  /** Image en cours de recadrage. */
  cropId: string | null;
  /** Nœuds sélectionnés (« sous-tracé:nœud ») du tracé édité avec l'outil Nœud. */
  nodeSelection: string[];
  /** Lissage du crayon, de 0 à 100. */
  pencilSmoothing: number;
  /** Cadre de texte dont on choisit le cadre suivant (après un clic sur son indicateur de débordement). */
  linkFrom: string | null;
  /** Fichier courant : chemin (bureau) ou nom (navigateur). */
  filePath: string | null;
  dialog: Dialog;
  toast: string | null;
  cursor: { x: number; y: number } | null;
}

const SETTINGS_KEY = 'poulpe.settings';

function loadSettings(): Settings {
  const fallback: Settings = {
    theme: 'dark',
    toolsSide: 'right',
    studioSide: 'right',
    rulers: true,
    grid: false,
    snapping: true,
    library: true,
    showWelcome: true,
  };
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return fallback;
  }
}

/** Petit magasin d'état observable, lu par React via `useSyncExternalStore`. */
class Store<T> {
  private listeners = new Set<() => void>();
  constructor(private state: T) {}
  get = () => this.state;
  set = (patch: Partial<T> | ((s: T) => Partial<T>)) => {
    const p = typeof patch === 'function' ? patch(this.state) : patch;
    this.state = { ...this.state, ...p };
    this.listeners.forEach((l) => l());
  };
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
}

export function starterDocument(): PoulpeDocument {
  const doc = createDocument({ name: t('app.untitled'), width: 1080, height: 1350 });
  doc.artboards[0].name = t('name.artboard', { n: 1 });
  return doc;
}

export const editor = new Editor(starterDocument());

export const ui = new Store<UiState>({
  persona: 'draw',
  tool: 'select',
  view: { zoom: 0.5, panX: 100, panY: 60 },
  settings: loadSettings(),
  defaults: { ...defaultStyle(), cornerRadius: 0, sides: 6, points: 5, innerRatio: 0.5 },
  colorTarget: 'fill',
  recentColors: [],
  editingTextId: null,
  cropId: null,
  nodeSelection: [],
  pencilSmoothing: 50,
  linkFrom: null,
  filePath: null,
  dialog: null,
  toast: null,
  cursor: null,
});

export function setSettings(patch: Partial<Settings>): void {
  const settings = { ...ui.get().settings, ...patch };
  ui.set({ settings });
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* stockage indisponible */
  }
}

export function pushRecentColor(color: string): void {
  const list = [color, ...ui.get().recentColors.filter((c) => c !== color)].slice(0, 12);
  ui.set({ recentColors: list });
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(message: string): void {
  ui.set({ toast: message });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.set({ toast: null }), 3500);
}

export function useEditor(): EditorState {
  return useSyncExternalStore(editor.subscribe, editor.getState);
}

export function useUi<T>(select: (s: UiState) => T): T {
  return useSyncExternalStore(ui.subscribe, () => select(ui.get()));
}

export function setTool(tool: ToolId): void {
  if (ui.get().tool !== tool) window.dispatchEvent(new Event('poulpe:toolchange'));
  ui.set({ tool, editingTextId: null, cropId: null, nodeSelection: [] });
}

/** Redessine le composant quand la sélection dans le texte édité change. */
export function useTextSelection(): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener('poulpe:textselection', bump);
    return () => window.removeEventListener('poulpe:textselection', bump);
  }, []);
}
