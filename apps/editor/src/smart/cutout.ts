import { findNode, type ImageNode } from '@poulpe/core';
import { t } from '../i18n';
import { commitBitmap, maskOf, maskSize, makeCanvas, selectedImage } from '../photo/pixels';
import { selectFromMatte } from '../photo/selection';
import { editor, toast, ui, type SelectionMode } from '../store';
import { traceSource } from './vectorize';
import { WorkerClient } from './workers';
import { getPerformanceSettings } from '../perf';

/*
 * Détourage automatique par IA, sur l'ordinateur : « Sélectionner le sujet » (menu Sélection) et
 * « Supprimer l'arrière-plan » (menu Calque, qui pose un masque de calque modifiable, comme dans
 * Photoshop). Le modèle U²-Net tourne dans un Web Worker, sans connexion ni service payant.
 */

type MatteRequest = {
  modelUrl: string;
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Fils de calcul du modèle (Préférences > Performances). */
  threads: number;
};

const client = new WorkerClient<MatteRequest, { alpha: Uint8ClampedArray }>(
  () => new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' }),
);

/** Résolution de travail : le masque est affiné à cette taille, puis agrandi en douceur. */
const WORK_SIDE = 1024;

const modelUrl = () => new URL('models/silueta.onnx', document.baseURI).href;

export function canCutout(): boolean {
  return selectedImage() !== null && !ui.get().busy;
}

/** Masque du sujet (opacité) sur la partie visible de l'image, à la résolution de travail. */
export async function subjectMatte(node: ImageNode): Promise<HTMLCanvasElement | null> {
  const px = traceSource(node, WORK_SIDE);
  if (!px) return null;
  const label = t('smart.cutoutBusy');
  ui.set({ busy: { label, progress: 0 } });
  try {
    const data = new Uint8ClampedArray(px.data);
    const { alpha } = await client.run(
      {
        modelUrl: modelUrl(),
        data,
        width: px.width,
        height: px.height,
        threads: getPerformanceSettings().workerThreads,
      },
      (r) => !!r.alpha,
      [data.buffer],
      (progress) => ui.set({ busy: { label, progress } }),
    );
    const canvas = makeCanvas(px.width, px.height);
    const out = new ImageData(px.width, px.height);
    for (let i = 0; i < alpha.length; i++) {
      out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = 255;
      out.data[i * 4 + 3] = alpha[i];
    }
    canvas.getContext('2d')!.putImageData(out, 0, 0);
    return canvas;
  } catch (e) {
    const missing = e instanceof Error && e.message === 'model-missing';
    toast(t(missing ? 'smart.modelMissing' : 'smart.cutoutFailed'));
    console.error(e);
    return null;
  } finally {
    ui.set({ busy: null });
  }
}

/** Sélection > Sélectionner le sujet. */
export async function selectSubject(mode: SelectionMode = ui.get().selectionMode): Promise<boolean> {
  const node = selectedImage();
  if (!node) return false;
  const matte = await subjectMatte(node);
  if (!matte) return false;
  selectFromMatte(node, matte, mode);
  return true;
}

/**
 * Calque > Supprimer l'arrière-plan : le fond est caché par un masque de calque (on peut le
 * retoucher au pinceau, le désactiver ou le supprimer). Un masque existant est conservé et combiné.
 */
export async function removeBackground(): Promise<boolean> {
  const node = selectedImage();
  if (!node) return false;
  const matte = await subjectMatte(node);
  const now = findNode(editor.doc, node.id)?.node;
  if (!matte || !now) return false;
  const { width, height } = maskSize(now);
  const canvas = maskOf(now) ?? makeCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  if (!now.mask) ctx.drawImage(matte, 0, 0, canvas.width, canvas.height);
  else {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(matte, 0, 0, canvas.width, canvas.height);
  }
  commitBitmap(now.id, 'mask', canvas, 'history.removeBackground');
  return true;
}
