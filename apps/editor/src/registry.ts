import type { Command } from './commands';

/*
 * Commandes ajoutées pendant l'exécution (macros, extensions). Module sans dépendance, pour
 * pouvoir être chargé avant la liste des commandes de l'appli.
 */

const dynamic = new Map<string, Command>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version++;
  listeners.forEach((l) => l());
}

export function registerCommand(id: string, cmd: Command): void {
  dynamic.set(id, cmd);
  emit();
}

/** Retire la commande `prefix`, ou toutes celles qui commencent par lui. */
export function unregisterCommand(prefix: string): void {
  for (const id of [...dynamic.keys()]) if (id === prefix || id.startsWith(prefix)) dynamic.delete(id);
  emit();
}

export function subscribeCommands(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function commandsVersion(): number {
  return version;
}

export function dynamicCommands(): [string, Command][] {
  return [...dynamic.entries()];
}

export function dynamicCommand(id: string): Command | undefined {
  return dynamic.get(id);
}
