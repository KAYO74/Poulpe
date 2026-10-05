import {
  EDGES,
  clampFrame,
  raisePanel,
  startPanelResize,
  usePanels,
  useWindowSize,
  type PanelId,
} from './panelLayout';

/** Fenêtre flottante : position et taille libres, poignées sur les bords et les coins. */
export function FloatingFrame({
  id,
  className = '',
  label,
  children,
}: {
  id: PanelId;
  className?: string;
  label: string;
  children: React.ReactNode;
}) {
  useWindowSize();
  const frame = usePanels((s) => s.floating[id]);
  const z = usePanels((s) => s.order.indexOf(id));
  if (!frame) return null;
  const { x, y, w, h } = clampFrame(frame);
  return (
    <div
      className={`float-panel ${className}`}
      role="dialog"
      aria-label={label}
      data-testid={`float-${id}`}
      style={{ left: x, top: y, width: w, height: h, zIndex: 40 + Math.max(0, z) }}
      onPointerDownCapture={() => raisePanel(id)}
    >
      {children}
      {EDGES.map((edge) => (
        <div
          key={edge}
          className={`float-edge ${edge}`}
          data-testid={`resize-${id}-${edge}`}
          aria-hidden="true"
          onPointerDown={(e) => startPanelResize(e, id, edge)}
        />
      ))}
    </div>
  );
}
