import type { Adjustment, StrokeJoin, TraceOptions } from '@poulpe/core';

/*
 * Enregistreur de macros : les actions de l'utilisateur sont notées pendant l'enregistrement.
 * Ce module ne dépend d'aucun autre module de l'appli, pour que chacun puisse y noter ses actions.
 */

export type MacroStep =
  /** Une commande des menus ou d'un raccourci (son identifiant). */
  | { kind: 'command'; id: string }
  /** Un filtre appliqué aux pixels du calque, avec ses réglages. */
  | { kind: 'filter'; adjustment: Adjustment }
  /** Un calque de réglage ; `nodeId` sert à relever ses réglages définitifs à la fin. */
  | { kind: 'adjustment'; adjustment: Adjustment; nodeId?: string }
  | { kind: 'offset'; distance: number; join: StrokeJoin }
  | { kind: 'selectionModify'; mode: 'feather' | 'grow' | 'shrink'; radius: number }
  | { kind: 'nudge'; dx: number; dy: number }
  | { kind: 'vectorize'; options: TraceOptions; maxSide: number; original: 'keep' | 'hide' | 'delete' }
  /** Une commande d'extension et ses paramètres. */
  | { kind: 'extension'; extension: string; command: string; params: Record<string, unknown> };

let steps: MacroStep[] | null = null;
/** Pendant la lecture d'une macro, rien n'est enregistré. */
let paused = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function isRecording(): boolean {
  return steps !== null;
}

export function recordedSteps(): readonly MacroStep[] {
  return steps ?? [];
}

export function startRecording(): void {
  steps = [];
  emit();
}

/** Arrête l'enregistrement et renvoie les étapes notées. */
export function stopRecording(): MacroStep[] {
  const out = steps ?? [];
  steps = null;
  emit();
  return out;
}

export function recordStep(step: MacroStep): void {
  if (!steps || paused) return;
  // Deux décalages au clavier de suite n'en font qu'un.
  const last = steps[steps.length - 1];
  if (step.kind === 'nudge' && last?.kind === 'nudge') {
    last.dx += step.dx;
    last.dy += step.dy;
  } else steps.push(step);
  emit();
}

/** Exécute `fn` sans rien enregistrer (lecture d'une macro). */
export async function withoutRecording<T>(fn: () => Promise<T>): Promise<T> {
  paused++;
  try {
    return await fn();
  } finally {
    paused--;
  }
}

export function subscribeRecorder(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
