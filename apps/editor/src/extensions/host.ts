import { useSyncExternalStore } from 'react';
import {
  findArtboard,
  findNode,
  insertNode,
  removeNodes,
  groupNodes,
  createGroup,
  type PoulpeDocument,
} from '@poulpe/core';
import type {
  QuickJSContext,
  QuickJSHandle,
  QuickJSRuntime,
  QuickJSWASMModule,
} from 'quickjs-emscripten-core';
import { registerCommand, unregisterCommand } from '../registry';
import { getLang, t } from '../i18n';
import { recordStep } from '../macros/recorder';
import { editor, toast, ui } from '../store';
import { applyPatch, createFromSpec, snapshot, type ShapeSpec } from './api';
import PRELUDE from './prelude.js?raw';

/*
 * Extensions : de petits programmes JavaScript qui ajoutent des commandes à Poulpe (menu
 * Extensions). Chacune tourne dans un interpréteur JavaScript isolé (QuickJS compilé en
 * WebAssembly) : elle ne voit que l'objet `poulpe` décrit dans docs/extensions.md, sans accès aux
 * fichiers, à Internet, à la page ni à l'appli de bureau. Mémoire et temps de calcul sont limités.
 */

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
}

/** Texte traduit d'une extension : une chaîne, ou { fr, en }. */
export type Localized = string | { fr?: string; en?: string };

export interface ExtensionParam {
  id: string;
  label: Localized;
  type: 'number' | 'text' | 'color' | 'boolean' | 'select';
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: Localized }[];
}

export interface ExtensionCommandInfo {
  id: string;
  title: Localized;
  params?: ExtensionParam[];
  /** La commande a besoin d'objets sélectionnés. */
  needsSelection?: boolean;
}

export interface InstalledExtension {
  manifest: ExtensionManifest;
  source: string;
  enabled: boolean;
}

interface Loaded {
  manifest: ExtensionManifest;
  commands: ExtensionCommandInfo[];
  runtime: QuickJSRuntime;
  vm: QuickJSContext;
}

const KEY = 'poulpe.extensions';
const MEMORY_LIMIT = 64 * 1024 * 1024;
const TIME_LIMIT_MS = 5000;

let installed: InstalledExtension[] = loadInstalled();
const loaded = new Map<string, Loaded>();
const listeners = new Set<() => void>();
let quickjs: Promise<QuickJSWASMModule> | null = null;

function loadInstalled(): InstalledExtension[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((e) => e?.manifest?.id && typeof e.source === 'string') : [];
  } catch {
    return [];
  }
}

function changed(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(installed));
  } catch {
    /* stockage indisponible */
  }
  listeners.forEach((l) => l());
}

export function useExtensions(): InstalledExtension[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => installed,
  );
}

export function localized(v: Localized | undefined): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v[getLang()] ?? v.fr ?? v.en ?? '';
}

async function engine(): Promise<QuickJSWASMModule> {
  quickjs ??= (async () => {
    const [{ newQuickJSWASMModuleFromVariant, newVariant }, variant, wasm] = await Promise.all([
      import('quickjs-emscripten-core'),
      import('@jitl/quickjs-wasmfile-release-sync'),
      import('@jitl/quickjs-wasmfile-release-sync/wasm?url'),
    ]);
    return newQuickJSWASMModuleFromVariant(newVariant(variant.default, { wasmLocation: wasm.default }));
  })();
  return quickjs;
}

// ————— Accès au document pendant une commande —————

type Recipe = (d: PoulpeDocument) => void;

/** Modifications d'une commande en cours : appliquées en aperçu, une seule étape d'historique à la fin. */
interface Session {
  ops: Recipe[];
  dirty: boolean;
  selection?: string[];
  artboardId: string;
}

let session: Session | null = null;

function flush(): void {
  const s = session;
  if (!s || !s.dirty) return;
  s.dirty = false;
  editor.preview((d) => {
    for (const op of s.ops) op(d);
    return s.selection;
  });
}

function mutate(op: Recipe): void {
  if (!session) throw new Error(t('ext.noDocumentAccess'));
  session.ops.push(op);
  session.dirty = true;
}

function selectionIds(): string[] {
  flush();
  return session?.selection ?? editor.selection;
}

/** Les opérations de l'objet `poulpe` (voir prelude.js). */
function hostCall(ext: Loaded | null, pending: Partial<Loaded>, op: string, args: unknown): unknown {
  const a = (args ?? {}) as Record<string, unknown>;
  switch (op) {
    case 'manifest': {
      const m = args as ExtensionManifest;
      if (!m || typeof m.id !== 'string' || !/^[\w.-]{1,100}$/.test(m.id) || typeof m.name !== 'string')
        throw new Error('poulpe.extension({ id, name, version }) : id ou nom invalide');
      pending.manifest = {
        id: m.id,
        name: String(m.name).slice(0, 100),
        version: String(m.version ?? '1.0.0').slice(0, 30),
        description: m.description ? String(m.description).slice(0, 500) : undefined,
        author: m.author ? String(m.author).slice(0, 100) : undefined,
      };
      return null;
    }
    case 'command': {
      const c = args as ExtensionCommandInfo;
      if (!c || typeof c.id !== 'string' || !/^[\w.-]{1,100}$/.test(c.id))
        throw new Error('poulpe.command : id invalide');
      (pending.commands ??= []).push({
        id: c.id,
        title: c.title ?? c.id,
        params: Array.isArray(c.params) ? c.params.slice(0, 30) : undefined,
        needsSelection: !!c.needsSelection,
      });
      return null;
    }
    case 'log':
      console.info(`[${ext?.manifest.id ?? pending.manifest?.id ?? 'extension'}]`, a);
      return null;
    case 'lang':
      return getLang();
    case 'toast':
      toast(String(args).slice(0, 300));
      return null;
    case 'document': {
      flush();
      const d = editor.doc;
      return {
        name: d.name,
        artboards: d.artboards.map((ab) => ({
          id: ab.id,
          name: ab.name,
          x: ab.x,
          y: ab.y,
          width: ab.width,
          height: ab.height,
        })),
      };
    }
    case 'artboard': {
      flush();
      const ab = findArtboard(editor.doc, session?.artboardId ?? editor.getState().activeArtboardId);
      return ab
        ? {
            id: ab.id,
            name: ab.name,
            x: ab.x,
            y: ab.y,
            width: ab.width,
            height: ab.height,
            children: ab.children.map(snapshot),
          }
        : null;
    }
    case 'selection':
      return selectionIds()
        .map((id) => findNode(editor.doc, id)?.node)
        .filter((n) => !!n)
        .map((n) => snapshot(n!));
    case 'find': {
      flush();
      const n = findNode(editor.doc, String(a.id))?.node;
      return n ? snapshot(n) : null;
    }
    case 'create': {
      const spec = a.spec as ShapeSpec & { parent?: string };
      const node = createFromSpec(spec);
      const parentId = typeof spec.parent === 'string' ? spec.parent : (session?.artboardId ?? '');
      mutate((d) => {
        const parent = findArtboard(d, parentId) ?? (findNode(d, parentId)?.node as never) ?? d.artboards[0];
        if (parent && 'children' in parent) insertNode(parent, structuredClone(node));
      });
      return node.id;
    }
    case 'update': {
      const id = String(a.id);
      const patch = a.patch as Partial<ShapeSpec>;
      mutate((d) => {
        const n = findNode(d, id)?.node;
        if (n && !n.locked) applyPatch(n, patch);
      });
      return null;
    }
    case 'remove': {
      const ids = (Array.isArray(a.ids) ? a.ids : [a.ids]).map(String);
      mutate((d) => void removeNodes(d, ids));
      if (session?.selection) session.selection = session.selection.filter((s) => !ids.includes(s));
      return null;
    }
    case 'select': {
      const ids = (Array.isArray(a.ids) ? a.ids : []).map(String);
      if (!session) throw new Error(t('ext.noDocumentAccess'));
      session.selection = ids;
      session.dirty = true;
      return null;
    }
    case 'group': {
      const ids = (Array.isArray(a.ids) ? a.ids : []).map(String);
      const g = createGroup([], typeof a.name === 'string' ? a.name : t('name.group'));
      mutate((d) => void groupNodes(d, ids, g));
      return g.id;
    }
  }
  throw new Error(`opération inconnue : ${op}`);
}

/** Évalue le code d'une extension dans un interpréteur neuf ; renvoie son manifeste et ses commandes. */
async function evaluate(source: string): Promise<Loaded> {
  const QuickJS = await engine();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT);
  runtime.setMaxStackSize(1024 * 1024);
  const vm = runtime.newContext();
  const pending: Partial<Loaded> = {};
  let self: Loaded | null = null;
  const host = vm.newFunction('__host', (opH: QuickJSHandle, argsH: QuickJSHandle) => {
    const op = vm.getString(opH);
    const raw = vm.getString(argsH);
    try {
      const result = hostCall(self, pending, op, raw ? JSON.parse(raw) : null);
      return vm.newString(JSON.stringify(result ?? null));
    } catch (e) {
      return { error: vm.newError(e instanceof Error ? e.message : String(e)) };
    }
  });
  vm.setProp(vm.global, '__host', host);
  host.dispose();
  const run = (code: string, name: string) => {
    const deadline = Date.now() + TIME_LIMIT_MS;
    runtime.setInterruptHandler(() => Date.now() > deadline);
    const r = vm.evalCode(code, name);
    if (r.error) {
      const err = vm.dump(r.error);
      r.error.dispose();
      throw new Error(typeof err === 'object' && err && 'message' in err ? String(err.message) : String(err));
    }
    r.value.dispose();
  };
  try {
    run(PRELUDE, 'prelude.js');
    run(source, 'extension.js');
    if (!pending.manifest) throw new Error(t('ext.noManifest'));
  } catch (e) {
    vm.dispose();
    runtime.dispose();
    throw e;
  }
  self = { manifest: pending.manifest, commands: pending.commands ?? [], runtime, vm };
  return self;
}

function unload(id: string): void {
  const l = loaded.get(id);
  if (!l) return;
  unregisterCommand(`ext:${id}/`);
  l.vm.dispose();
  l.runtime.dispose();
  loaded.delete(id);
}

/** Pour une commande avec paramètres : la boîte de dialogue à ouvrir. */
export let pendingParams: { extension: string; command: ExtensionCommandInfo } | null = null;

function register(l: Loaded): void {
  for (const c of l.commands) {
    registerCommand(`ext:${l.manifest.id}/${c.id}`, {
      label: 'menu.extensions',
      title: localized(c.title),
      enabled: () => !c.needsSelection || editor.selection.length > 0,
      run: () => {
        if (c.params?.length) {
          pendingParams = { extension: l.manifest.id, command: c };
          ui.set({ dialog: 'extensionParams' });
          return undefined;
        }
        return runExtensionCommand(l.manifest.id, c.id, {});
      },
    });
  }
}

/** Charge les extensions installées et actives (au lancement). */
export async function startExtensions(): Promise<void> {
  for (const ext of installed.filter((e) => e.enabled)) {
    try {
      const l = await evaluate(ext.source);
      loaded.set(l.manifest.id, l);
      register(l);
    } catch (e) {
      console.error(`Extension ${ext.manifest.id}`, e);
      toast(t('ext.loadFailed', { name: ext.manifest.name }));
    }
  }
}

/**
 * Lance une commande d'extension : ses modifications forment une seule étape d'historique.
 * Renvoie false si elle n'a pas pu s'exécuter.
 */
export function runExtensionCommand(extId: string, cmdId: string, params: Record<string, unknown>): boolean {
  const l = loaded.get(extId);
  const info = l?.commands.find((c) => c.id === cmdId);
  if (!l || !info || session) return false;
  session = { ops: [], dirty: false, artboardId: editor.getState().activeArtboardId };
  const { vm, runtime } = l;
  const deadline = Date.now() + TIME_LIMIT_MS;
  runtime.setInterruptHandler(() => Date.now() > deadline);
  const fn = vm.getProp(vm.global, '__run');
  const a = vm.newString(cmdId);
  const p = vm.newString(JSON.stringify(params ?? {}));
  const r = vm.callFunction(fn, vm.undefined, a, p);
  fn.dispose();
  a.dispose();
  p.dispose();
  const s = session;
  session = null;
  if (r.error) {
    const err = vm.dump(r.error);
    r.error.dispose();
    editor.cancel();
    console.error(`[${extId}]`, err);
    toast(
      t('ext.failed', {
        name: localized(info.title),
        message: String((err as { message?: string })?.message ?? err),
      }),
    );
    return false;
  }
  r.value.dispose();
  if (s.ops.length || s.selection) {
    s.dirty = true;
    session = s;
    flush();
    session = null;
    editor.commit(localized(info.title));
  }
  recordStep({ kind: 'extension', extension: extId, command: cmdId, params });
  return true;
}

/** Lit un fichier d'extension sans l'installer (pour la confirmation). */
export async function inspectExtension(
  source: string,
): Promise<{ manifest: ExtensionManifest; commands: string[] }> {
  const l = await evaluate(source);
  const out = { manifest: l.manifest, commands: l.commands.map((c) => localized(c.title)) };
  l.vm.dispose();
  l.runtime.dispose();
  return out;
}

/** Installe (ou met à jour) une extension et l'active. */
export async function installExtension(source: string): Promise<ExtensionManifest> {
  const l = await evaluate(source);
  unload(l.manifest.id);
  loaded.set(l.manifest.id, l);
  register(l);
  installed = [
    ...installed.filter((e) => e.manifest.id !== l.manifest.id),
    { manifest: l.manifest, source, enabled: true },
  ];
  changed();
  return l.manifest;
}

export async function setExtensionEnabled(id: string, enabled: boolean): Promise<void> {
  const ext = installed.find((e) => e.manifest.id === id);
  if (!ext) return;
  if (!enabled) unload(id);
  else if (!loaded.has(id)) {
    const l = await evaluate(ext.source);
    loaded.set(id, l);
    register(l);
  }
  installed = installed.map((e) => (e.manifest.id === id ? { ...e, enabled } : e));
  changed();
}

export function uninstallExtension(id: string): void {
  unload(id);
  installed = installed.filter((e) => e.manifest.id !== id);
  changed();
}

/** Commandes d'une extension chargée (pour le menu Extensions). */
export function extensionCommands(id: string): ExtensionCommandInfo[] {
  return loaded.get(id)?.commands ?? [];
}
