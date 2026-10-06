/*
 * Petits clients des Web Workers de la vectorisation et du détourage : un worker par tâche,
 * gardé ouvert (le modèle de détourage reste chargé), un numéro par demande.
 */

type Reply<T> = { id: number; progress?: number; error?: string } & Partial<T>;

export class WorkerClient<Req extends object, Res extends object> {
  private worker: Worker | null = null;
  private nextId = 1;

  constructor(private readonly create: () => Worker) {}

  private busy = 0;
  private stale = false;

  /** Ferme le worker dès qu'il ne calcule plus rien : la prochaine demande en crée un neuf. */
  reset(): void {
    this.stale = true;
    if (this.busy === 0) this.close();
  }

  private close(): void {
    this.stale = false;
    this.worker?.terminate();
    this.worker = null;
  }

  private get(): Worker {
    this.worker ??= this.create();
    return this.worker;
  }

  /** Envoie une demande ; `done` dit quelle réponse est la dernière. */
  run(
    req: Req,
    done: (r: Reply<Res>) => boolean,
    transfer: Transferable[] = [],
    onProgress?: (f: number) => void,
  ): Promise<Res> {
    const w = this.get();
    const id = this.nextId++;
    this.busy++;
    return new Promise<Res>((resolve, reject) => {
      const cleanup = () => {
        w.removeEventListener('message', onMessage);
        w.removeEventListener('error', onError);
        this.busy--;
        if (this.stale && this.busy === 0 && this.worker === w) this.close();
      };
      const onMessage = (e: MessageEvent<Reply<Res>>) => {
        if (e.data.id !== id) return;
        if (e.data.error) {
          cleanup();
          reject(new Error(e.data.error));
        } else if (done(e.data)) {
          cleanup();
          resolve(e.data as unknown as Res);
        } else if (e.data.progress !== undefined) onProgress?.(e.data.progress);
      };
      const onError = (e: ErrorEvent) => {
        cleanup();
        this.worker?.terminate();
        this.worker = null;
        reject(e.error ?? new Error(e.message));
      };
      w.addEventListener('message', onMessage);
      w.addEventListener('error', onError);
      w.postMessage({ ...req, id }, transfer);
    });
  }
}
