import type { PoulpeDocument } from '@poulpe/core';

/*
 * Images modifiées dans l'appli (coups de pinceau, gomme magique, masques).
 *
 * Réencoder une grande photo en PNG après chaque coup de pinceau prendrait une demi-seconde.
 * Le pixel modifié est donc gardé tel quel en mémoire : le document ne contient qu'une
 * référence `poulpe-bitmap:N` à la place des données, et le PNG est encodé en arrière-plan.
 * Avant d'enregistrer ou d'exporter, `materialize` remplace ces références par les vraies
 * données.
 */

const PREFIX = 'poulpe-bitmap:';

interface Entry {
  canvas: HTMLCanvasElement | null;
  /** Données PNG en `data:` URL, une fois encodées. */
  data: string | null;
  pending: Promise<string>;
  /** Image décodée quand la toile a été libérée. */
  image: HTMLImageElement | null;
  used: number;
}

const entries = new Map<string, Entry>();
let counter = 0;
let clock = 0;
/** Nombre de toiles gardées décodées : les plus anciennes ne restent qu'en PNG. */
const KEEP = 10;

export function isBitmapRef(data: string): boolean {
  return data.startsWith(PREFIX);
}

function encode(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('encodage impossible'));
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    }, 'image/png'),
  );
}

function evict(): void {
  const live = [...entries.values()].filter((e) => e.canvas && e.data);
  if (live.length <= KEEP) return;
  live.sort((a, b) => a.used - b.used);
  for (const e of live.slice(0, live.length - KEEP)) e.canvas = null;
}

/**
 * Confie une toile au magasin et renvoie la référence à mettre dans `Asset.data`. La toile ne doit
 * plus être modifiée ensuite.
 */
export function registerBitmap(canvas: HTMLCanvasElement): string {
  const key = `${PREFIX}${++counter}`;
  const entry: Entry = { canvas, data: null, pending: Promise.resolve(''), image: null, used: ++clock };
  entry.pending = encode(canvas).then((data) => {
    entry.data = data;
    evict();
    return data;
  });
  entries.set(key, entry);
  return key;
}

/**
 * Source affichable d'une référence : la toile si elle est encore en mémoire, sinon l'image
 * décodée depuis le PNG (null tant qu'elle se décode ; `onLoad` est alors appelé).
 */
export function bitmapSource(data: string, onLoad?: () => void): HTMLCanvasElement | HTMLImageElement | null {
  const e = entries.get(data);
  if (!e) return null;
  e.used = ++clock;
  if (e.canvas) return e.canvas;
  if (!e.image && e.data) {
    const img = new Image();
    img.onload = () => onLoad?.();
    img.src = e.data;
    e.image = img;
  }
  return e.image && e.image.complete && e.image.naturalWidth ? e.image : null;
}

/** Données réelles (`data:` URL) d'une valeur d'`Asset.data`. */
export async function resolveData(data: string): Promise<string> {
  if (!isBitmapRef(data)) return data;
  const e = entries.get(data);
  if (!e) throw new Error('image introuvable');
  return e.data ?? (await e.pending);
}

/** Copie du document où toutes les images ont leurs vraies données (pour enregistrer ou exporter). */
export async function materialize(doc: PoulpeDocument): Promise<PoulpeDocument> {
  const ids = Object.keys(doc.assets).filter((id) => isBitmapRef(doc.assets[id].data));
  if (!ids.length) return doc;
  const assets = { ...doc.assets };
  for (const id of ids) assets[id] = { ...assets[id], data: await resolveData(assets[id].data) };
  return { ...doc, assets };
}
