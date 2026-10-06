/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web/wasm';
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import { MATTE_INPUT, matteInput, refineMatte } from '@poulpe/core/src/matte';

/*
 * Détourage automatique, hors du fil de l'interface : le modèle U²-Net tourne sur l'ordinateur
 * (ONNX Runtime en WebAssembly), sans connexion. Le modèle est chargé une fois puis gardé.
 */

ort.env.wasm.wasmPaths = { wasm: new URL(wasmUrl, self.location.href).href };
// Plusieurs threads WebAssembly demandent une page isolée (en-têtes COOP et COEP) ; sinon un seul.
// Le nombre est fixé par la première demande (Préférences > Performances).
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

let session: Promise<ort.InferenceSession> | null = null;

async function load(modelUrl: string): Promise<ort.InferenceSession> {
  const res = await fetch(modelUrl);
  if (!res.ok) throw new Error('model-missing');
  const bytes = new Uint8Array(await res.arrayBuffer());
  return ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
}

self.onmessage = async (
  e: MessageEvent<{
    id: number;
    modelUrl: string;
    data: Uint8ClampedArray;
    width: number;
    height: number;
    threads: number;
  }>,
) => {
  const { id, modelUrl, data, width, height, threads } = e.data;
  try {
    if (!session) ort.env.wasm.numThreads = self.crossOriginIsolated ? threads : 1;
    self.postMessage({ id, progress: 0.1 });
    session ??= load(modelUrl).catch((err) => {
      session = null;
      throw err;
    });
    const s = await session;
    self.postMessage({ id, progress: 0.4 });
    const img = { data, width, height };
    const input = new ort.Tensor('float32', matteInput(img), [1, 3, MATTE_INPUT, MATTE_INPUT]);
    const out = await s.run({ [s.inputNames[0]]: input });
    // La première sortie (d0) est la carte la plus fine.
    const raw = out[s.outputNames[0]].data as Float32Array;
    self.postMessage({ id, progress: 0.85 });
    const alpha = refineMatte(img, raw);
    self.postMessage({ id, alpha }, { transfer: [alpha.buffer] });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
