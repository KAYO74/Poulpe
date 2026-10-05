import type { Box, PathCommand, Vec } from './geometry';

/* Courbes de Bézier cubiques : évaluation, découpe, boîte englobante, aplatissement. */

const EPS = 1e-6;
const same = (a: Vec, b: Vec) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS;
const pt = (x: number, y: number): Vec => ({ x, y });

/** Courbe de Bézier cubique : départ, deux points de contrôle, arrivée. */
export type Cubic = [Vec, Vec, Vec, Vec];

export function cubicPoint(b: Cubic, t: number): Vec {
  const u = 1 - t;
  const a = u * u * u,
    c = 3 * u * u * t,
    d = 3 * u * t * t,
    e = t * t * t;
  return pt(
    a * b[0].x + c * b[1].x + d * b[2].x + e * b[3].x,
    a * b[0].y + c * b[1].y + d * b[2].y + e * b[3].y,
  );
}

export function cubicDerivative(b: Cubic, t: number): Vec {
  const u = 1 - t;
  const a = 3 * u * u,
    c = 6 * u * t,
    d = 3 * t * t;
  return pt(
    a * (b[1].x - b[0].x) + c * (b[2].x - b[1].x) + d * (b[3].x - b[2].x),
    a * (b[1].y - b[0].y) + c * (b[2].y - b[1].y) + d * (b[3].y - b[2].y),
  );
}

/** Coupe une courbe en `t` (algorithme de De Casteljau). */
export function splitCubic(b: Cubic, t: number): [Cubic, Cubic] {
  const lerp = (p: Vec, q: Vec) => pt(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);
  const p01 = lerp(b[0], b[1]),
    p12 = lerp(b[1], b[2]),
    p23 = lerp(b[2], b[3]);
  const p012 = lerp(p01, p12),
    p123 = lerp(p12, p23);
  const m = lerp(p012, p123);
  return [
    [b[0], p01, p012, m],
    [m, p123, p23, b[3]],
  ];
}

/** Valeurs de t (0 < t < 1) où la dérivée d'une coordonnée s'annule. */
function extremaT(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const out: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) out.push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const s = Math.sqrt(disc);
      out.push((-b + s) / (2 * a), (-b - s) / (2 * a));
    }
  }
  return out.filter((t) => t > 0 && t < 1);
}

/** Boîte englobante exacte d'une courbe. */
export function cubicBounds(b: Cubic): Box {
  const ts = [0, 1, ...extremaT(b[0].x, b[1].x, b[2].x, b[3].x), ...extremaT(b[0].y, b[1].y, b[2].y, b[3].y)];
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const t of ts) {
    const p = cubicPoint(b, t);
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Paramètre du point de la courbe le plus proche de `p`, et sa distance. */
export function nearestOnCubic(b: Cubic, p: Vec): { t: number; dist: number } {
  let best = 0,
    bestD = Infinity;
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const q = cubicPoint(b, i / N);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = i / N;
    }
  }
  // Affinage par dichotomie autour du meilleur échantillon.
  let step = 1 / N;
  for (let k = 0; k < 12; k++) {
    step /= 2;
    for (const t of [best - step, best + step]) {
      if (t < 0 || t > 1) continue;
      const q = cubicPoint(b, t);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
  }
  return { t: best, dist: bestD };
}

/** Commandes d'un tracé découpées en courbes (les droites deviennent des courbes aux poignées alignées). */
export function commandsToCubics(cmds: PathCommand[]): { cubics: Cubic[]; closed: boolean }[] {
  const out: { cubics: Cubic[]; closed: boolean }[] = [];
  let cur: { cubics: Cubic[]; closed: boolean } | null = null;
  let p = pt(0, 0),
    start = pt(0, 0);
  const line = (a: Vec, b: Vec): Cubic => [
    a,
    pt(a.x + (b.x - a.x) / 3, a.y + (b.y - a.y) / 3),
    pt(a.x + ((b.x - a.x) * 2) / 3, a.y + ((b.y - a.y) * 2) / 3),
    b,
  ];
  for (const c of cmds) {
    if (c.op === 'M') {
      cur = { cubics: [], closed: false };
      out.push(cur);
      p = start = pt(c.x, c.y);
      continue;
    }
    if (!cur) {
      cur = { cubics: [], closed: false };
      out.push(cur);
    }
    if (c.op === 'Z') {
      if (!same(p, start)) cur.cubics.push(line(p, start));
      cur.closed = true;
      p = start;
      cur = null;
      continue;
    }
    const q = pt(c.x, c.y);
    cur.cubics.push(c.op === 'L' ? line(p, q) : [p, pt(c.x1, c.y1), pt(c.x2, c.y2), q]);
    p = q;
  }
  return out;
}

/** Boîte englobante exacte d'un tracé. */
export function exactBounds(cmds: PathCommand[]): Box | null {
  let box: Box | null = null;
  const add = (b: Box) => {
    if (!box) {
      box = { ...b };
      return;
    }
    const x1 = Math.max(box.x + box.width, b.x + b.width),
      y1 = Math.max(box.y + box.height, b.y + b.height);
    box.x = Math.min(box.x, b.x);
    box.y = Math.min(box.y, b.y);
    box.width = x1 - box.x;
    box.height = y1 - box.y;
  };
  let p: Vec | null = null;
  for (const c of cmds) {
    if (c.op === 'M') {
      p = pt(c.x, c.y);
      add({ x: c.x, y: c.y, width: 0, height: 0 });
    } else if (c.op === 'L') {
      p = pt(c.x, c.y);
      add({ x: c.x, y: c.y, width: 0, height: 0 });
    } else if (c.op === 'C') {
      add(cubicBounds([p ?? pt(c.x1, c.y1), pt(c.x1, c.y1), pt(c.x2, c.y2), pt(c.x, c.y)]));
      p = pt(c.x, c.y);
    }
  }
  return box;
}

/** Tracé aplati en lignes brisées (tolérance en unités du tracé). */
export function flattenCommands(cmds: PathCommand[], tolerance = 0.5): { points: Vec[]; closed: boolean }[] {
  return commandsToCubics(cmds).map(({ cubics, closed }) => {
    const points: Vec[] = cubics.length ? [cubics[0][0]] : [];
    for (const b of cubics) {
      // Nombre de pas d'après la longueur du polygone de contrôle.
      const len =
        Math.hypot(b[1].x - b[0].x, b[1].y - b[0].y) +
        Math.hypot(b[2].x - b[1].x, b[2].y - b[1].y) +
        Math.hypot(b[3].x - b[2].x, b[3].y - b[2].y);
      const straight =
        Math.abs((b[3].x - b[0].x) * (b[1].y - b[0].y) - (b[3].y - b[0].y) * (b[1].x - b[0].x)) < EPS &&
        Math.abs((b[3].x - b[0].x) * (b[2].y - b[0].y) - (b[3].y - b[0].y) * (b[2].x - b[0].x)) < EPS;
      const n = straight
        ? 1
        : Math.min(200, Math.max(2, Math.ceil(Math.sqrt(len / Math.max(tolerance, 0.01)))));
      for (let i = 1; i <= n; i++) points.push(cubicPoint(b, i / n));
    }
    return { points, closed };
  });
}

/** Le point est-il à l'intérieur du tracé (aplati) ? */
export function pointInPolylines(
  polys: { points: Vec[]; closed: boolean }[],
  p: Vec,
  rule: 'nonzero' | 'evenodd' = 'nonzero',
): boolean {
  let winding = 0,
    crossings = 0;
  for (const { points } of polys) {
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const a = points[i],
        b = points[(i + 1) % n];
      if (a.y <= p.y) {
        if (b.y > p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) > 0) {
          winding++;
          crossings++;
        }
      } else if (b.y <= p.y && (b.x - a.x) * (p.y - a.y) - (p.x - a.x) * (b.y - a.y) < 0) {
        winding--;
        crossings++;
      }
    }
  }
  return rule === 'evenodd' ? crossings % 2 === 1 : winding !== 0;
}

/** Plus petite distance entre un point et les lignes brisées. */
export function distanceToPolylines(polys: { points: Vec[]; closed: boolean }[], p: Vec): number {
  let best = Infinity;
  for (const { points, closed } of polys) {
    const n = points.length;
    if (n === 1) best = Math.min(best, Math.hypot(points[0].x - p.x, points[0].y - p.y));
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = points[i],
        b = points[(i + 1) % n];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
      best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
    }
  }
  return best;
}
