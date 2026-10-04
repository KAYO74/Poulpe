import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cssFont, findNode, rgbaToCss, type TextNode } from '@poulpe/core';
import { CanvasController } from '../canvas/controller';
import { currentEditedText, endTextEdit, setEditedText } from '../canvas/textEdit';
import { placeImageBytes } from '../io';
import { ui, useEditor, useUi } from '../store';

let controller: CanvasController | null = null;
export const getController = () => controller;

const RULER = 18;

export function Viewport() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rulerX = useRef<HTMLCanvasElement>(null);
  const rulerY = useRef<HTMLCanvasElement>(null);
  const rulers = useUi((s) => s.settings.rulers);

  useLayoutEffect(() => {
    const host = hostRef.current!;
    const c = new CanvasController(canvasRef.current!, host);
    controller = c;
    const area = canvasRef.current!.parentElement!;
    let fitted = false;
    const ro = new ResizeObserver(() => {
      const r = area.getBoundingClientRect();
      c.resize(r.width, r.height);
      if (!fitted && r.width > 0) {
        fitted = true;
        c.zoomToFit();
      }
      drawRulers();
    });
    ro.observe(area);
    const drawRulers = () => {
      if (rulerX.current && rulerY.current) paintRulers(rulerX.current, rulerY.current, c);
    };
    const unsub = ui.subscribe(drawRulers);
    return () => {
      ro.disconnect();
      unsub();
      c.dispose();
      controller = null;
    };
  }, []);

  useEffect(() => {
    if (controller && rulerX.current && rulerY.current)
      paintRulers(rulerX.current, rulerY.current, controller);
  }, [rulers]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (!file || !controller) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const at = controller.toWorld(e.clientX - rect.left, e.clientY - rect.top);
    await placeImageBytes(new Uint8Array(await file.arrayBuffer()), file.type, at);
  };

  return (
    <div
      ref={hostRef}
      className={`viewport${rulers ? ' with-rulers' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {rulers && (
        <>
          <div className="ruler-corner" />
          <canvas ref={rulerX} className="ruler ruler-x" aria-hidden="true" />
          <canvas ref={rulerY} className="ruler ruler-y" aria-hidden="true" />
        </>
      )}
      <div className="canvas-area">
        <canvas ref={canvasRef} className="main-canvas" data-testid="canvas" tabIndex={-1} />
        <TextEditor />
      </div>
    </div>
  );
}

function paintRulers(cx: HTMLCanvasElement, cy: HTMLCanvasElement, c: CanvasController) {
  const dpr = window.devicePixelRatio || 1;
  const cs = getComputedStyle(cx);
  const bg = cs.getPropertyValue('--ruler').trim() || '#26262b';
  const tick = cs.getPropertyValue('--tick').trim() || '#6e6c78';
  const { zoom, panX, panY } = ui.get().view;
  // Pas des graduations : au moins 60 px d'écran entre deux étiquettes.
  const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const step = steps.find((s) => s * zoom >= 60) ?? 10000;
  const draw = (canvas: HTMLCanvasElement, length: number, pan: number, vertical: boolean) => {
    canvas.width = Math.round((vertical ? RULER : length) * dpr);
    canvas.height = Math.round((vertical ? length : RULER) * dpr);
    canvas.style.width = `${vertical ? RULER : length}px`;
    canvas.style.height = `${vertical ? length : RULER}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, vertical ? RULER : length, vertical ? length : RULER);
    ctx.strokeStyle = tick;
    ctx.fillStyle = tick;
    ctx.font = '9px "Inter", system-ui, sans-serif';
    ctx.lineWidth = 1;
    const start = Math.floor(-pan / zoom / step) * step;
    const end = (length - pan) / zoom;
    ctx.beginPath();
    for (let v = start; v <= end; v += step / 5) {
      const s = Math.round(v * zoom + pan) + 0.5;
      const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      const h = major ? RULER : 5;
      if (vertical) {
        ctx.moveTo(RULER - h, s);
        ctx.lineTo(RULER, s);
      } else {
        ctx.moveTo(s, RULER - h);
        ctx.lineTo(s, RULER);
      }
      if (major) {
        const label = String(Math.round(v));
        if (vertical) {
          ctx.save();
          ctx.translate(9, s + 3);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(label, 0, 0);
          ctx.restore();
        } else ctx.fillText(label, s + 3, 9);
      }
    }
    ctx.stroke();
  };
  draw(cx, c.width, panX, false);
  draw(cy, c.height, panY, true);
}

/** Zone de saisie posée sur le texte en cours d'édition, à la même taille et la même police. */
function TextEditor() {
  const editingId = useUi((s) => s.editingTextId);
  const state = useEditor();
  useUi((s) => s.view);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [initial, setInitial] = useState('');

  useEffect(() => {
    if (!editingId) return;
    setInitial(currentEditedText());
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, [editingId]);

  if (!editingId || !controller) return null;
  const node = findNode(state.doc, editingId)?.node as TextNode | undefined;
  const fallback = ui.get().defaults;
  const style = node?.style ?? fallback.text;
  const frame = node
    ? controller.screenFrame(node)
    : { x: 0, y: 0, width: 10, height: style.fontSize, rotation: 0, zoom: ui.get().view.zoom };
  const color = node?.fill.type === 'solid' ? rgbaToCss(node.fill.color) : '#888';
  const z = frame.zoom;
  return (
    <textarea
      ref={ref}
      className="text-editor"
      data-testid="text-editor"
      defaultValue={initial}
      key={editingId + initial}
      spellCheck={false}
      wrap={node?.autoWidth ? 'off' : 'soft'}
      style={{
        left: frame.x,
        top: frame.y,
        width: Math.max(frame.width + 4 * z, 8),
        height: Math.max(frame.height, style.fontSize * style.lineHeight * z),
        transform: frame.rotation ? `rotate(${frame.rotation}deg)` : undefined,
        font: cssFont({ ...style, fontSize: style.fontSize * z }),
        lineHeight: style.lineHeight,
        letterSpacing: `${style.letterSpacing * z}px`,
        textAlign: style.align,
        textTransform: style.uppercase ? 'uppercase' : 'none',
        whiteSpace: node?.autoWidth ? 'pre' : 'pre-wrap',
        color,
        caretColor: color,
      }}
      onChange={(e) => setEditedText(e.target.value)}
      onBlur={() => endTextEdit()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
    />
  );
}
