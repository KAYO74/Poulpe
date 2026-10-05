/// <reference lib="webworker" />
// Import direct du module : le reste de @poulpe/core (Paper.js…) n'a rien à faire dans le worker.
import { inpaint } from '@poulpe/core/src/inpaint';

/*
 * Gomme magique, hors du fil de l'interface : reçoit les pixels d'une zone et le masque du
 * trou, renvoie les pixels reconstruits.
 */
self.onmessage = (
  e: MessageEvent<{ id: number; data: Uint8ClampedArray; width: number; height: number; hole: Uint8Array }>,
) => {
  const { id, data, width, height, hole } = e.data;
  inpaint({ data, width, height }, hole, {
    onProgress: (progress) => self.postMessage({ id, progress }),
  });
  self.postMessage({ id, data }, { transfer: [data.buffer] });
};
