import {
  anchorKey,
  artboardAt,
  bendSegment,
  cachedSvgPath,
  cloneSubpaths,
  createPath,
  deleteAnchors,
  exactBounds,
  findArtboard,
  findNode,
  fromSubpaths,
  insertAnchor,
  isSmooth,
  moveAnchors,
  moveHandle,
  nearestSegment,
  newId,
  parseAnchorKey,
  pathToSvg,
  pathToWorld,
  removeNodes,
  setAnchorKind,
  setPathCommands,
  simplifyPoints,
  toSubpaths,
  worldToPath,
  type Anchor,
  type PathNode,
  type Paint,
  type Stroke,
  type SubPath,
  type Vec,
} from '@poulpe/core';
import { t } from '../i18n';
import { editor, ui } from '../store';
import type { CanvasController } from './controller';
import { collectSnapLines, snapPoint } from './snapping';

/*
 * Outils de tracé : plume (courbes de Bézier nœud par nœud), crayon (main levée, lissé) et
 * outil Nœud (modifier les nœuds et poignées d'un tracé). Tous passent par les gestes de
 * l'éditeur : chaque tracé, chaque modification de nœuds s'annule en une fois.
 */

const HIT = 7;

type NodeDrag =
  | { kind: 'anchors'; id: string; base: SubPath[]; start: Vec; keys: string[]; moved: boolean }
  | { kind: 'handle'; id: string; base: SubPath[]; key: string; which: 'in' | 'out'; smooth: boolean }
  | {
      kind: 'segment';
      id: string;
      base: SubPath[];
      si: number;
      seg: number;
      t: number;
      startScreen: Vec;
      moved: boolean;
    };

interface PenState {
  id: string;
  artboardId: string;
  anchors: Anchor[];
  closed: boolean;
  /** Nœud dont on tire les poignées (bouton enfoncé). */
  dragIndex: number | null;
}

/** Contour visible pour les tracés dessinés : celui des réglages, ou un trait sombre de 2 px. */
function drawnStroke(): Stroke {
  const s = ui.get().defaults.stroke;
  return s.paint.type === 'none'
    ? { paint: { type: 'solid', color: '#1a1a1d' }, width: 2 }
    : { ...s, width: Math.max(0.5, s.width) };
}

function constrain45(from: Vec, p: Vec): Vec {
  const dx = p.x - from.x,
    dy = p.y - from.y;
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  const len = Math.hypot(dx, dy) * Math.cos(Math.atan2(dy, dx) - ang);
  return { x: from.x + Math.cos(ang) * len, y: from.y + Math.sin(ang) * len };
}

export class PathTools {
  private pen: PenState | null = null;
  private hover: Vec | null = null;
  private pencil: { points: Vec[]; artboardId: string } | null = null;
  private drag: NodeDrag | null = null;

  constructor(private readonly c: CanvasController) {
    window.addEventListener('poulpe:toolchange', this.finishPen);
  }

  dispose(): void {
    window.removeEventListener('poulpe:toolchange', this.finishPen);
  }

  get busy(): boolean {
    return !!(this.pen || this.pencil || this.drag);
  }

  private dist(a: Vec, b: Vec): number {
    const sa = this.c.toScreen(a),
      sb = this.c.toScreen(b);
    return Math.hypot(sa.x - sb.x, sa.y - sb.y);
  }

  /** Tracé modifiable par l'outil Nœud : le seul objet sélectionné, s'il est un tracé. */
  editablePath(): PathNode | null {
    if (ui.get().tool !== 'direct') return null;
    const sel = editor.selection;
    if (sel.length !== 1) return null;
    const n = findNode(editor.doc, sel[0])?.node;
    return n?.type === 'path' && !n.locked && n.visible ? n : null;
  }

  // ————— Plume —————

  private snapPen(p: Vec, shift: boolean, ctrl: boolean): Vec {
    const pen = this.pen;
    const last = pen?.anchors[pen.anchors.length - 1];
    if (shift && last) return constrain45(last, p);
    if (!this.c.snapping() || ctrl) return p;
    const lines = collectSnapLines(editor.doc, new Set(pen ? [pen.id] : []));
    return snapPoint(p, lines, this.c.snapThreshold(), this.c.gridStep());
  }

  private updatePen(): void {
    const pen = this.pen;
    if (!pen) return;
    const cmds = fromSubpaths([{ anchors: pen.anchors, closed: pen.closed }]);
    const b = exactBounds(cmds) ?? { x: pen.anchors[0].x, y: pen.anchors[0].y, width: 0, height: 0 };
    const d = pathToSvg(cmds);
    const fill: Paint = pen.closed ? ui.get().defaults.fill : { type: 'none' };
    editor.preview((doc) => {
      let n = findNode(doc, pen.id)?.node;
      if (!n) {
        const ab = findArtboard(doc, pen.artboardId) ?? doc.artboards[0];
        const created = createPath(
          { ...b, d, viewBox: b, name: t('name.curve') },
          { ...ui.get().defaults, stroke: drawnStroke() },
        );
        created.id = pen.id;
        ab.children.push(created);
        n = ab.children[ab.children.length - 1];
      }
      if (n.type !== 'path') return;
      Object.assign(n, { x: b.x, y: b.y, width: b.width, height: b.height, d, viewBox: { ...b } });
      n.fill = fill;
      return [pen.id];
    });
  }

  /** Termine le tracé en cours à la plume (Entrée, Échap, changement d'outil). */
  finishPen = (): void => {
    const pen = this.pen;
    if (!pen) return;
    this.pen = null;
    this.hover = null;
    if (pen.anchors.length < 2) editor.cancel();
    else {
      editor.commit('history.pen');
      editor.select([pen.id]);
    }
    this.c.requestDraw();
  };

  private penDown(e: PointerEvent, p: Vec): void {
    const doc = editor.doc;
    if (!this.pen) {
      const ab = artboardAt(doc, p) ?? findArtboard(doc, editor.getState().activeArtboardId);
      if (!ab) return;
      editor.setActiveArtboard(ab.id);
      this.pen = { id: newId(), artboardId: ab.id, anchors: [], closed: false, dragIndex: null };
    }
    const pen = this.pen;
    const a = pen.anchors;
    if (a.length >= 2 && this.dist(a[0], p) <= HIT + 1) {
      // Clic sur le premier nœud : le tracé se ferme (et prend le remplissage courant).
      pen.closed = true;
      pen.dragIndex = 0;
      this.updatePen();
      return;
    }
    if (a.length && this.dist(a[a.length - 1], p) <= 3) {
      // Second clic au même endroit (double-clic) : fin du tracé ouvert.
      this.finishPen();
      return;
    }
    const q = this.snapPen(p, e.shiftKey, e.ctrlKey);
    a.push({ x: q.x, y: q.y, in: null, out: null });
    pen.dragIndex = a.length - 1;
    this.updatePen();
  }

  private penMove(e: PointerEvent, p: Vec): void {
    const pen = this.pen;
    if (!pen) return;
    if (pen.dragIndex === null) {
      this.hover = this.snapPen(p, e.shiftKey, e.ctrlKey);
      this.c.requestDraw();
      return;
    }
    const a = pen.anchors[pen.dragIndex];
    if (this.dist(a, p) < 3 && !a.out) return;
    const q = e.shiftKey ? constrain45(a, p) : p;
    // On tire la poignée de sortie ; Alt casse la symétrie (nœud anguleux).
    if (pen.closed && pen.dragIndex === 0) {
      // En refermant, on règle la poignée d'arrivée sur le premier nœud.
      const mirrored = { x: 2 * a.x - q.x, y: 2 * a.y - q.y };
      moveHandle(a, 'in', mirrored, e.altKey ? false : 'symmetric');
    } else moveHandle(a, 'out', q, e.altKey ? false : 'symmetric');
    this.updatePen();
  }

  private penUp(): void {
    const pen = this.pen;
    if (!pen) return;
    pen.dragIndex = null;
    if (pen.closed) this.finishPen();
  }

  // ————— Crayon —————

  private pencilUp(): void {
    const pc = this.pencil;
    this.pencil = null;
    if (!pc || pc.points.length < 2) {
      this.c.requestDraw();
      return;
    }
    const pts = pc.points;
    const zoom = this.c.view.zoom;
    const closed = pts.length > 8 && this.dist(pts[0], pts[pts.length - 1]) < 10;
    const smoothing = ui.get().pencilSmoothing / 100;
    const cmds = simplifyPoints(pts, (0.3 + smoothing * 8) / zoom, closed);
    const b = exactBounds(cmds);
    if (!b) return;
    const node = createPath(
      { ...b, d: pathToSvg(cmds), viewBox: b, name: t('name.curve') },
      { ...ui.get().defaults, stroke: drawnStroke() },
    );
    node.fill = { type: 'none' };
    editor.apply('history.pencil', (d) => {
      (findArtboard(d, pc.artboardId) ?? d.artboards[0]).children.push(node);
      return [node.id];
    });
  }

  // ————— Outil Nœud —————

  private subpathsOf(n: PathNode): SubPath[] {
    return toSubpaths(cachedSvgPath(n.d));
  }

  /** Nœud ou poignée sous le point écran. */
  private hitAnchor(n: PathNode, sps: SubPath[], s: Vec): { key: string; which: 'in' | 'out' | null } | null {
    const sel = new Set(ui.get().nodeSelection);
    const scr = (p: Vec) => this.c.toScreen(pathToWorld(n, p));
    const near = (p: Vec) => {
      const q = scr(p);
      return Math.hypot(q.x - s.x, q.y - s.y) <= HIT;
    };
    // Les poignées des nœuds sélectionnés passent en premier : elles peuvent recouvrir un nœud.
    for (let si = 0; si < sps.length; si++)
      for (let ai = 0; ai < sps[si].anchors.length; ai++) {
        const key = anchorKey(si, ai);
        if (!sel.has(key)) continue;
        const a = sps[si].anchors[ai];
        if (a.out && near(a.out)) return { key, which: 'out' };
        if (a.in && near(a.in)) return { key, which: 'in' };
      }
    for (let si = 0; si < sps.length; si++)
      for (let ai = 0; ai < sps[si].anchors.length; ai++)
        if (near(sps[si].anchors[ai])) return { key: anchorKey(si, ai), which: null };
    return null;
  }

  private nodeDown(e: PointerEvent, p: Vec, s: Vec, n: PathNode): boolean {
    const sps = this.subpathsOf(n);
    const hit = this.hitAnchor(n, sps, s);
    const pp = worldToPath(n, p);
    if (hit?.which) {
      const [si, ai] = parseAnchorKey(hit.key);
      editor.begin();
      this.drag = {
        kind: 'handle',
        id: n.id,
        base: sps,
        key: hit.key,
        which: hit.which,
        smooth: isSmooth(sps[si].anchors[ai]),
      };
      return true;
    }
    if (hit) {
      let sel = ui.get().nodeSelection;
      if (e.shiftKey) sel = sel.includes(hit.key) ? sel.filter((k) => k !== hit.key) : [...sel, hit.key];
      else if (!sel.includes(hit.key)) sel = [hit.key];
      ui.set({ nodeSelection: sel });
      if (!sel.includes(hit.key)) return true;
      editor.begin();
      this.drag = { kind: 'anchors', id: n.id, base: sps, start: pp, keys: sel, moved: false };
      return true;
    }
    const seg = nearestSegment(sps, pp);
    if (seg) {
      const q = this.c.toScreen(pathToWorld(n, seg.point));
      if (Math.hypot(q.x - s.x, q.y - s.y) <= HIT) {
        editor.begin();
        this.drag = {
          kind: 'segment',
          id: n.id,
          base: sps,
          si: seg.si,
          seg: seg.seg,
          t: seg.t,
          startScreen: s,
          moved: false,
        };
        return true;
      }
    }
    return false;
  }

  private previewNodes(id: string, sps: SubPath[]): void {
    editor.preview((d) => {
      const n = findNode(d, id)?.node;
      if (n?.type === 'path') setPathCommands(n, fromSubpaths(sps));
    });
  }

  private nodeMove(e: PointerEvent, p: Vec, s: Vec): void {
    const g = this.drag;
    if (!g) return;
    // Les conversions passent par le tracé tel qu'il était au début du geste.
    const base = findNode(editor.getState().doc, g.id)?.node;
    const origin = this.gestureNode(g.id) ?? (base?.type === 'path' ? base : null);
    if (!origin) return;
    const pp = worldToPath(origin, p);
    const sps = cloneSubpaths(g.base);
    if (g.kind === 'anchors') {
      let dx = pp.x - g.start.x,
        dy = pp.y - g.start.y;
      if (!g.moved && this.dist(pathToWorld(origin, g.start), p) < 3) return;
      g.moved = true;
      if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
      moveAnchors(sps, g.keys, dx, dy);
    } else if (g.kind === 'handle') {
      const [si, ai] = parseAnchorKey(g.key);
      const a = sps[si].anchors[ai];
      const q = e.shiftKey ? constrain45(a, pp) : pp;
      moveHandle(a, g.which, q, g.smooth && !e.altKey ? 'angle' : false);
    } else {
      if (!g.moved && Math.hypot(s.x - g.startScreen.x, s.y - g.startScreen.y) < 3) return;
      g.moved = true;
      bendSegment(sps, g.si, g.seg, g.t, pp);
    }
    this.previewNodes(g.id, sps);
  }

  /** L'objet tel qu'au début du geste en cours (base de l'aperçu). */
  private gestureBase: { id: string; node: PathNode } | null = null;
  private gestureNode(id: string): PathNode | null {
    if (this.gestureBase?.id === id) return this.gestureBase.node;
    return null;
  }

  private nodeUp(): void {
    const g = this.drag;
    this.drag = null;
    this.gestureBase = null;
    if (!g) return;
    if (g.kind === 'segment' && !g.moved) {
      // Simple clic sur un segment : on y ajoute un nœud.
      editor.cancel();
      const sps = cloneSubpaths(g.base);
      const key = insertAnchor(sps, g.si, g.seg, g.t);
      editor.apply('history.nodes', (d) => {
        const n = findNode(d, g.id)?.node;
        if (n?.type === 'path') setPathCommands(n, fromSubpaths(sps));
      });
      ui.set({ nodeSelection: [key] });
      return;
    }
    if (g.kind === 'anchors' && !g.moved) {
      editor.cancel();
      return;
    }
    editor.commit('history.nodes');
  }

  /** Applique une modification aux nœuds sélectionnés du tracé édité (barre contextuelle, clavier). */
  editNodes(kind: 'sharp' | 'smooth' | 'delete' | 'toggleClosed'): void {
    const n = this.editablePath();
    if (!n) return;
    let sps = cloneSubpaths(this.subpathsOf(n));
    const keys = ui.get().nodeSelection;
    if (kind === 'delete') {
      if (!keys.length) return;
      sps = deleteAnchors(sps, keys);
      ui.set({ nodeSelection: [] });
      if (!sps.length) {
        editor.apply('history.delete', (d) => {
          removeNodes(d, [n.id]);
          return [];
        });
        return;
      }
    } else if (kind === 'toggleClosed') {
      const touched = new Set(keys.map((k) => parseAnchorKey(k)[0]));
      const which = touched.size ? [...touched] : sps.map((_, i) => i);
      for (const si of which) if (sps[si]) sps[si].closed = !sps[si].closed;
    } else {
      if (!keys.length) return;
      setAnchorKind(sps, keys, kind);
    }
    editor.apply('history.nodes', (d) => {
      const m = findNode(d, n.id)?.node;
      if (m?.type === 'path') setPathCommands(m, fromSubpaths(sps));
    });
  }

  // ————— Évènements, appelés par le contrôleur du canevas —————

  pointerDown(e: PointerEvent, p: Vec, s: Vec): boolean {
    const tool = ui.get().tool;
    if (tool === 'pen') {
      this.penDown(e, p);
      return true;
    }
    if (tool === 'pencil') {
      const doc = editor.doc;
      const ab = artboardAt(doc, p) ?? findArtboard(doc, editor.getState().activeArtboardId);
      if (!ab) return true;
      editor.setActiveArtboard(ab.id);
      this.pencil = { points: [p], artboardId: ab.id };
      return true;
    }
    const n = this.editablePath();
    if (n && this.nodeDown(e, p, s, n)) {
      this.gestureBase = { id: n.id, node: n };
      return true;
    }
    return false;
  }

  pointerMove(e: PointerEvent, p: Vec, s: Vec): boolean {
    const tool = ui.get().tool;
    if (tool === 'pen') {
      this.penMove(e, p);
      return true;
    }
    if (this.pencil) {
      const last = this.pencil.points[this.pencil.points.length - 1];
      if (this.dist(last, p) >= 1.5) {
        this.pencil.points.push(p);
        this.c.requestDraw();
      }
      return true;
    }
    if (this.drag) {
      this.nodeMove(e, p, s);
      return true;
    }
    return false;
  }

  pointerUp(): boolean {
    if (ui.get().tool === 'pen' && this.pen) {
      this.penUp();
      return true;
    }
    if (this.pencil) {
      this.pencilUp();
      return true;
    }
    if (this.drag) {
      this.nodeUp();
      return true;
    }
    return false;
  }

  pointerCancel(): void {
    if (this.drag) editor.cancel();
    this.drag = null;
    this.pencil = null;
  }

  doubleClick(p: Vec, s: Vec): boolean {
    const n = this.editablePath();
    if (!n) return false;
    const hit = this.hitAnchor(n, this.subpathsOf(n), s);
    if (!hit || hit.which) return false;
    const [si, ai] = parseAnchorKey(hit.key);
    const a = this.subpathsOf(n)[si].anchors[ai];
    ui.set({ nodeSelection: [hit.key] });
    this.editNodes(a.in || a.out ? 'sharp' : 'smooth');
    void p;
    return true;
  }

  /** Clavier : Entrée / Échap terminent la plume, Retour arrière retire le dernier nœud, Suppr supprime les nœuds. */
  key(e: KeyboardEvent): boolean {
    if (this.pen) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        this.finishPen();
        return true;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        this.pen.anchors.pop();
        if (!this.pen.anchors.length) {
          this.pen = null;
          editor.cancel();
        } else this.updatePen();
        this.c.requestDraw();
        return true;
      }
    }
    if (
      (e.key === 'Delete' || e.key === 'Backspace') &&
      this.editablePath() &&
      ui.get().nodeSelection.length
    ) {
      this.editNodes('delete');
      return true;
    }
    if (e.key === 'Escape' && ui.get().nodeSelection.length) {
      ui.set({ nodeSelection: [] });
      return true;
    }
    return false;
  }

  // ————— Dessin (repère de l'écran) —————

  draw(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    const square = (p: Vec, filled: boolean, size = 7) => {
      const q = this.c.toScreen(p);
      ctx.fillStyle = filled ? color : '#ffffff';
      ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size);
      ctx.strokeRect(q.x - size / 2 + 0.5, q.y - size / 2 + 0.5, size - 1, size - 1);
    };
    const handle = (a: Vec, h: Vec | null) => {
      if (!h) return;
      const qa = this.c.toScreen(a),
        qh = this.c.toScreen(h);
      ctx.beginPath();
      ctx.moveTo(qa.x, qa.y);
      ctx.lineTo(qh.x, qh.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(qh.x, qh.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
    };

    const pen = this.pen;
    if (pen && pen.anchors.length) {
      const a = pen.anchors;
      const last = a[a.length - 1];
      if (this.hover && pen.dragIndex === null && !pen.closed) {
        // Segment élastique jusqu'au pointeur.
        const s0 = this.c.toScreen(last),
          c1 = this.c.toScreen(last.out ?? last),
          s1 = this.c.toScreen(this.hover);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.bezierCurveTo(c1.x, c1.y, s1.x, s1.y, s1.x, s1.y);
        ctx.stroke();
        if (a.length >= 2 && this.dist(a[0], this.hover) <= HIT + 1) {
          const q = this.c.toScreen(a[0]);
          ctx.beginPath();
          ctx.arc(q.x, q.y, 7, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      const active = pen.dragIndex !== null ? a[pen.dragIndex] : last;
      handle(active, active.in);
      handle(active, active.out);
      a.forEach((p) => square(p, p === active, 6));
    }

    if (this.pencil) {
      const pts = this.pencil.points.map((p) => this.c.toScreen(p));
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const n = this.editablePath();
    if (n && !this.pen) {
      const sps = this.subpathsOf(n);
      const sel = new Set(ui.get().nodeSelection);
      const w = (p: Vec) => pathToWorld(n, p);
      sps.forEach((sp, si) =>
        sp.anchors.forEach((a, ai) => {
          if (!sel.has(anchorKey(si, ai))) return;
          handle(w(a), a.in && w(a.in));
          handle(w(a), a.out && w(a.out));
        }),
      );
      sps.forEach((sp, si) => sp.anchors.forEach((a, ai) => square(w(a), sel.has(anchorKey(si, ai)))));
    }
    ctx.restore();
  }
}
