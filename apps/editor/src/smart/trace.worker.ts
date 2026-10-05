/// <reference lib="webworker" />
// Import direct du module : le reste de @poulpe/core (Paper.js…) n'a rien à faire dans le worker.
import { traceImage, type TraceOptions } from '@poulpe/core/src/trace';

/* Vectorisation d'image, hors du fil de l'interface. */
self.onmessage = (
  e: MessageEvent<{
    id: number;
    data: Uint8ClampedArray;
    width: number;
    height: number;
    options: TraceOptions;
  }>,
) => {
  const { id, data, width, height, options } = e.data;
  try {
    const result = traceImage({ data, width, height }, options, (progress) =>
      self.postMessage({ id, progress }),
    );
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
