import {
  createDocument,
  createEllipse,
  createRect,
  createStar,
  createText,
  defaultStyle,
  findNode,
  translateNode,
  type SceneNode,
} from '@poulpe/core';
import { getController } from './components/Viewport';
import { editor, ui } from './store';

/*
 * Mesure des performances de dessin, pour comparer le navigateur et l'appli de bureau
 * (WebKitGTK sous Linux en particulier). Lancement : `?bench` dans l'URL de l'éditeur, ou
 * `POULPE_BENCH=1` pour l'appli de bureau, qui écrit le rapport sur la sortie standard.
 */

export interface BenchResult {
  scenario: string;
  frames: number;
  avgMs: number;
  p95Ms: number;
  fps: number;
}

export interface BenchReport {
  userAgent: string;
  viewport: { width: number; height: number; dpr: number };
  objects: number;
  results: BenchResult[];
}

const FRAMES = 60;

function stats(scenario: string, times: number[]): BenchResult {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((s, t) => s + t, 0) / times.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const r = (v: number) => Math.round(v * 100) / 100;
  return { scenario, frames: times.length, avgMs: r(avg), p95Ms: r(p95), fps: Math.round(1000 / avg) };
}

type Mix = 'all' | 'solid' | 'gradient' | 'text';

/**
 * Document d'essai : `count` objets variés (dégradés, contours, rotations) dont un texte sur 25.
 * `mix` ne garde qu'une famille d'objets, pour savoir ce qui coûte.
 */
function benchDocument(count: number, mix: Mix = 'all') {
  const doc = createDocument({ name: 'Mesure', width: 1920, height: 1080 });
  const ab = doc.artboards[0];
  const style = defaultStyle();
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    const box = { x: rand() * 1800, y: rand() * 1000, width: 30 + rand() * 120, height: 30 + rand() * 120 };
    let n: SceneNode;
    if (i % 25 === 0) {
      n = createText(
        { ...box, width: 260, text: 'Festival des Mers, du 12 au 14 juillet', autoWidth: false },
        style,
      );
    } else if (i % 3 === 0) n = createEllipse(box, style);
    else if (i % 3 === 1) n = createStar(box, style, 5, 0.5);
    else n = createRect(box, style);
    if ('fill' in n && n.type !== 'text')
      n.fill =
        i % 4 === 0
          ? {
              type: 'linear',
              angle: rand() * 360,
              stops: [
                { offset: 0, color: '#ff5c8a' },
                { offset: 1, color: '#4da3ff' },
              ],
            }
          : {
              type: 'solid',
              color: `#${Math.floor(rand() * 0xffffff)
                .toString(16)
                .padStart(6, '0')}`,
            };
    const keep =
      mix === 'all' ||
      (mix === 'text' && n.type === 'text') ||
      (mix === 'gradient' && n.type !== 'text' && n.fill.type === 'linear') ||
      (mix === 'solid' && n.type !== 'text' && n.fill.type === 'solid');
    if (!keep) continue;
    if ('stroke' in n) n.stroke = { paint: { type: 'solid', color: '#1a1a1d' }, width: 2 };
    n.rotation = i % 5 === 0 ? rand() * 90 : 0;
    ab.children.push(n);
  }
  return doc;
}

export async function runBenchmark(count = 1000): Promise<BenchReport> {
  const c = getController();
  if (!c) throw new Error('canevas absent');
  editor.load(benchDocument(count));
  c.zoomToFit();
  await new Promise((r) => setTimeout(r, 300));
  const results: BenchResult[] = [];
  const ctx = c.canvas.getContext('2d')!;
  const measure = (scenario: string, step: (i: number) => void) => {
    const times: number[] = [];
    for (let i = 0; i < FRAMES + 5; i++) {
      const t0 = performance.now();
      step(i);
      c.draw();
      // Lire un pixel force le navigateur à finir le dessin : on mesure le rendu réel.
      ctx.getImageData(0, 0, 1, 1);
      const dt = performance.now() - t0;
      if (i >= 5) times.push(dt);
    }
    results.push(stats(scenario, times));
  };

  for (const [mix, label] of [
    ['solid', 'formes unies seules'],
    ['gradient', 'formes en dégradé seules'],
    ['text', 'blocs de texte seuls'],
  ] as const) {
    editor.load(benchDocument(count, mix));
    measure(`redessin, ${label} (${editor.doc.artboards[0].children.length})`, () => {});
  }
  editor.load(benchDocument(count));
  measure('redessin complet', () => {});

  const ids = editor.doc.artboards[0].children.slice(0, 50).map((n) => n.id);
  editor.select(ids);
  editor.begin();
  measure('déplacement de 50 objets', (i) =>
    editor.preview((d) => {
      for (const id of ids) translateNode(findNode(d, id)!.node, i, i / 2);
    }),
  );
  editor.cancel();
  editor.select([]);

  const v0 = ui.get().view;
  measure('zoom et défilement', (i) => {
    const z = v0.zoom * (1 + 0.5 * Math.sin(i / 10));
    ui.set({ view: { zoom: z, panX: v0.panX + i * 3, panY: v0.panY - i * 2 } });
  });
  ui.set({ view: v0 });

  return {
    userAgent: navigator.userAgent,
    viewport: { width: c.width, height: c.height, dpr: window.devicePixelRatio || 1 },
    objects: count,
    results,
  };
}

/** Lance la mesure si elle est demandée (paramètre `?bench` ou appli de bureau en mode mesure). */
export async function maybeRunBenchmark(desktop: boolean): Promise<void> {
  let wanted = new URLSearchParams(location.search).has('bench');
  let invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
  if (desktop) {
    invoke = (await import('@tauri-apps/api/core')).invoke;
    wanted = Boolean(await invoke('bench_mode').catch(() => false));
  }
  if (!wanted) return;
  await new Promise((r) => setTimeout(r, 1000));
  const report = await runBenchmark();
  (window as unknown as { poulpeBench: BenchReport }).poulpeBench = report;
  console.log(JSON.stringify(report));
  if (invoke) await invoke('bench_report', { report: JSON.stringify(report, null, 2) });
}
