import type { Box, PathCommand, Vec } from './geometry';

/*
 * Lecture des données de tracé SVG (attribut `d`). Le résultat n'utilise que M, L, C et Z en
 * coordonnées absolues : les courbes quadratiques et les arcs sont convertis en courbes cubiques,
 * ce que savent dessiner le canevas, l'export SVG et l'export PDF.
 */

const ARGS: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

function tokenize(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /([MLHVCSQTAZmlhvcsqtaz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) out.push(m[1] ?? parseFloat(m[2]));
  return out;
}

/** Lit les drapeaux d'arc, qui peuvent être collés (« a5 5 0 011 1 »). */
function splitArcFlags(d: string): string {
  return d.replace(/([Aa])([^MLHVCSQTAZmlhvcsqtaz]*)/g, (_all, cmd: string, body: string) => {
    const nums = body.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
    // Les drapeaux (4e et 5e nombres de chaque arc) ne valent que 0 ou 1 : « 011 » = 0 1 1.
    const fixed: string[] = [];
    let i = 0;
    for (const raw of nums) {
      const pos = i % 7;
      if ((pos === 3 || pos === 4) && raw.length > 1 && /^[01]+\d*/.test(raw)) {
        fixed.push(raw[0]);
        i++;
        let rest = raw.slice(1);
        if (pos === 3 && rest.length) {
          fixed.push(rest[0]);
          i++;
          rest = rest.slice(1);
        }
        if (rest.length) {
          fixed.push(rest);
          i++;
        }
        continue;
      }
      fixed.push(raw);
      i++;
    }
    return `${cmd}${fixed.join(' ')} `;
  });
}

/** Arc elliptique SVG en courbes cubiques (algorithme de la spécification SVG, annexe F.6). */
function arcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  phiDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): PathCommand[] {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (!rx || !ry) return [{ op: 'L', x: x2, y: y2 }];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi),
    sin = Math.sin(phi);
  const dx = (x1 - x2) / 2,
    dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy,
    y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (largeArc === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry,
    cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2,
    cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const segments = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2) - 1e-9));
  const step = delta / segments;
  const k = (4 / 3) * Math.tan(step / 4);
  const point = (t: number): Vec => ({
    x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin,
    y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos,
  });
  const deriv = (t: number): Vec => ({
    x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin,
    y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos,
  });
  const out: PathCommand[] = [];
  let t = theta1;
  for (let i = 0; i < segments; i++) {
    const t2 = t + step;
    const p1 = point(t),
      p2 = i === segments - 1 ? { x: x2, y: y2 } : point(t2);
    const d1 = deriv(t),
      d2 = deriv(t2);
    out.push({
      op: 'C',
      x1: p1.x + k * d1.x,
      y1: p1.y + k * d1.y,
      x2: p2.x - k * d2.x,
      y2: p2.y - k * d2.y,
      x: p2.x,
      y: p2.y,
    });
    t = t2;
  }
  return out;
}

/** Convertit l'attribut `d` d'un tracé SVG en commandes absolues M, L, C et Z. */
export function parseSvgPath(d: string): PathCommand[] {
  const tokens = tokenize(splitArcFlags(d));
  const out: PathCommand[] = [];
  let i = 0;
  let cmd = '';
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0;
  // Dernier point de contrôle, pour les raccourcis S et T.
  let cx = 0,
    cy = 0,
    prev = '';
  while (i < tokens.length) {
    const tok = tokens[i];
    if (typeof tok === 'string') {
      cmd = tok;
      i++;
      if (cmd === 'Z' || cmd === 'z') {
        out.push({ op: 'Z' });
        x = sx;
        y = sy;
        prev = 'Z';
        continue;
      }
    } else if (!cmd) {
      break;
    }
    const up = cmd.toUpperCase();
    const n = ARGS[up];
    if (n === undefined || i + n > tokens.length) break;
    const a = tokens.slice(i, i + n) as number[];
    if (a.some((v) => typeof v !== 'number')) break;
    i += n;
    const rel = cmd !== up;
    const ox = rel ? x : 0,
      oy = rel ? y : 0;
    switch (up) {
      case 'M':
        x = a[0] + ox;
        y = a[1] + oy;
        sx = x;
        sy = y;
        out.push({ op: 'M', x, y });
        // Les paires suivantes d'un M sont des L.
        cmd = rel ? 'l' : 'L';
        break;
      case 'L':
        x = a[0] + ox;
        y = a[1] + oy;
        out.push({ op: 'L', x, y });
        break;
      case 'H':
        x = a[0] + ox;
        out.push({ op: 'L', x, y });
        break;
      case 'V':
        y = a[0] + oy;
        out.push({ op: 'L', x, y });
        break;
      case 'C': {
        const c = {
          op: 'C' as const,
          x1: a[0] + ox,
          y1: a[1] + oy,
          x2: a[2] + ox,
          y2: a[3] + oy,
          x: a[4] + ox,
          y: a[5] + oy,
        };
        out.push(c);
        cx = c.x2;
        cy = c.y2;
        x = c.x;
        y = c.y;
        break;
      }
      case 'S': {
        const r = prev === 'C' || prev === 'S';
        const x1 = r ? 2 * x - cx : x,
          y1 = r ? 2 * y - cy : y;
        const c = { op: 'C' as const, x1, y1, x2: a[0] + ox, y2: a[1] + oy, x: a[2] + ox, y: a[3] + oy };
        out.push(c);
        cx = c.x2;
        cy = c.y2;
        x = c.x;
        y = c.y;
        break;
      }
      case 'Q':
      case 'T': {
        let qx: number, qy: number, ex: number, ey: number;
        if (up === 'Q') {
          qx = a[0] + ox;
          qy = a[1] + oy;
          ex = a[2] + ox;
          ey = a[3] + oy;
        } else {
          const r = prev === 'Q' || prev === 'T';
          qx = r ? 2 * x - cx : x;
          qy = r ? 2 * y - cy : y;
          ex = a[0] + ox;
          ey = a[1] + oy;
        }
        out.push({
          op: 'C',
          x1: x + (2 / 3) * (qx - x),
          y1: y + (2 / 3) * (qy - y),
          x2: ex + (2 / 3) * (qx - ex),
          y2: ey + (2 / 3) * (qy - ey),
          x: ex,
          y: ey,
        });
        cx = qx;
        cy = qy;
        x = ex;
        y = ey;
        break;
      }
      case 'A': {
        const ex = a[5] + ox,
          ey = a[6] + oy;
        out.push(...arcToCubics(x, y, a[0], a[1], a[2], !!a[3], !!a[4], ex, ey));
        x = ex;
        y = ey;
        break;
      }
    }
    prev = up;
  }
  return out;
}

/** Boîte englobante d'un tracé (les courbes sont échantillonnées). */
export function commandsBounds(cmds: PathCommand[]): Box | null {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const add = (x: number, y: number) => {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  };
  let px = 0,
    py = 0;
  for (const c of cmds) {
    if (c.op === 'Z') continue;
    if (c.op === 'C') {
      for (let k = 1; k <= 16; k++) {
        const t = k / 16,
          u = 1 - t;
        add(
          u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        );
      }
    } else add(c.x, c.y);
    px = c.x;
    py = c.y;
  }
  if (x0 === Infinity) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

const parsed = new Map<string, PathCommand[]>();

/** `parseSvgPath` mémorisé : les icônes reviennent souvent, avec les mêmes données. */
export function cachedSvgPath(d: string): PathCommand[] {
  let cmds = parsed.get(d);
  if (!cmds) {
    cmds = parseSvgPath(d);
    if (parsed.size > 2000) parsed.clear();
    parsed.set(d, cmds);
  }
  return cmds;
}

/** Ramène un tracé de la boîte `from` à la boîte `to` (mise à l'échelle et translation). */
export function fitCommands(cmds: PathCommand[], from: Box, to: Box): PathCommand[] {
  const kx = from.width ? to.width / from.width : 1,
    ky = from.height ? to.height / from.height : 1;
  const X = (v: number) => to.x + (v - from.x) * kx;
  const Y = (v: number) => to.y + (v - from.y) * ky;
  return cmds.map((c) => {
    switch (c.op) {
      case 'M':
      case 'L':
        return { op: c.op, x: X(c.x), y: Y(c.y) };
      case 'C':
        return { op: 'C', x1: X(c.x1), y1: Y(c.y1), x2: X(c.x2), y2: Y(c.y2), x: X(c.x), y: Y(c.y) };
      case 'Z':
        return c;
    }
  });
}
