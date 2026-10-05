import {
  LUT_PRESETS,
  LutError,
  encodeLut,
  findArtboard,
  lutFromFunction,
  newId,
  parseCube,
  scaleNode,
  translateNode,
  walkDocument,
  type Adjustment,
  type Artboard,
  type LutPreset,
} from '@poulpe/core';
import { registerBitmap } from '@poulpe/render';
import { t } from '../i18n';
import { baseName, pickFile } from '../io';
import { editor, toast } from '../store';
import { addAdjustment } from './photoActions';
import { images, makeCanvas, pruneAssets } from './pixels';
import { clearSelection } from './selection';

/*
 * Commandes photo de la v0.6 : looks par table LUT, taille de l'image et taille de la zone de
 * travail.
 */

/** Résolution des looks intégrés : 17³ couleurs suffisent pour des courbes douces. */
const PRESET_SIZE = 17;

export function lutPresetAdjustment(preset: LutPreset): Adjustment {
  return {
    kind: 'lut',
    name: t(`lut.${preset}`),
    size: PRESET_SIZE,
    data: encodeLut(lutFromFunction(PRESET_SIZE, LUT_PRESETS[preset])),
  };
}

/** Ajoute un calque de réglage avec un look intégré. */
export function addLutPreset(preset: LutPreset): void {
  addAdjustment('lut', lutPresetAdjustment(preset), t(`lut.${preset}`));
}

/** Demande un fichier `.cube` et renvoie le réglage correspondant (null si annulé ou illisible). */
export async function pickLut(): Promise<Extract<Adjustment, { kind: 'lut' }> | null> {
  const file = await pickFile(['cube'], '.cube');
  if (!file) return null;
  try {
    const lut = parseCube(new TextDecoder().decode(file.bytes));
    const name = lut.title || baseName(file.name).replace(/\.cube$/i, '');
    return { kind: 'lut', name, size: lut.size, data: encodeLut(lut) };
  } catch (e) {
    if (!(e instanceof LutError)) console.error(e);
    toast(t('lut.invalid'));
    return null;
  }
}

/** Fichier > LUT : ajoute un calque de réglage d'après un fichier `.cube`. */
export async function loadLutFile(): Promise<void> {
  const adj = await pickLut();
  if (adj) addAdjustment('lut', adj, adj.name);
}

export function activeArtboard(): Artboard | null {
  return findArtboard(editor.doc, editor.getState().activeArtboardId) ?? editor.doc.artboards[0] ?? null;
}

/**
 * Taille de l'image : le plan de travail et tout son contenu sont mis à l'échelle. Avec
 * `resample`, les calques de pixels sont recalculés pour garder leur densité (une photo réduite
 * de moitié a quatre fois moins de pixels).
 */
export async function setImageSize(width: number, height: number, resample: boolean): Promise<void> {
  const ab = activeArtboard();
  if (!ab || width < 1 || height < 1) return;
  const sx = width / ab.width,
    sy = height / ab.height;
  if (Math.abs(sx - 1) < 1e-9 && Math.abs(sy - 1) < 1e-9) return;
  const doc = editor.doc;
  /** Images rééchantillonnées : ancien id → nouvelle image. */
  const replaced = new Map<string, { id: string; key: string; width: number; height: number }>();
  if (resample) {
    await images().ready(doc);
    for (const { node, artboard } of walkDocument(doc)) {
      if (artboard.id !== ab.id || node.type !== 'image' || replaced.has(node.assetId)) continue;
      const asset = doc.assets[node.assetId];
      const img = images().get(doc, node.assetId);
      if (!asset || !img) continue;
      const w = Math.max(1, Math.round(asset.width * sx)),
        h = Math.max(1, Math.round(asset.height * sy));
      const canvas = makeCanvas(w, h);
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      replaced.set(node.assetId, { id: newId('img'), key: registerBitmap(canvas), width: w, height: h });
    }
  }
  clearSelection(false);
  editor.apply('history.imageSize', (d) => {
    const a = findArtboard(d, ab.id);
    if (!a) return;
    const origin = { x: a.x, y: a.y };
    for (const child of a.children) scaleNode(child, sx, sy, origin, true);
    a.width = width;
    a.height = height;
    for (const { node, artboard } of walkDocument(d)) {
      if (artboard.id !== ab.id || node.type !== 'image') continue;
      const r = replaced.get(node.assetId);
      if (!r) continue;
      d.assets[r.id] ??= { id: r.id, mime: 'image/png', width: r.width, height: r.height, data: r.key };
      node.assetId = r.id;
    }
    pruneAssets(d);
  });
}

/**
 * Taille de la zone de travail : le plan de travail change de taille autour du point d'ancrage
 * (`ax`, `ay` : 0 = gauche ou haut, 0,5 = centre, 1 = droite ou bas), sans toucher au contenu.
 */
export function setCanvasSize(width: number, height: number, ax: number, ay: number): void {
  const ab = activeArtboard();
  if (!ab || width < 1 || height < 1) return;
  const dx = (width - ab.width) * ax,
    dy = (height - ab.height) * ay;
  editor.apply('history.canvasSize', (d) => {
    const a = findArtboard(d, ab.id);
    if (!a) return;
    a.width = width;
    a.height = height;
    for (const child of a.children) translateNode(child, dx, dy);
  });
}
