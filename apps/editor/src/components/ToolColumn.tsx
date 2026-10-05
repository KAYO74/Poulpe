import { setPaint } from '../actions';
import { PHOTO_TOOL_KEYS, TOOL_KEYS } from '../commands';
import { useT } from '../i18n';
import { importImage } from '../io';
import { setTool, ui, useEditor, useUi, type Persona, type ToolId } from '../store';
import { useActiveWorkspace } from '../workspaces';
import { findNode, isStyled } from '@poulpe/core';
import { paintPreview } from './fields';
import { Icon, type IconName } from './Icon';
import { useRef } from 'react';
import { FloatingFrame } from '../panels/FloatingFrame';
import { dockPanel, floatPanel, startPanelDrag, usePanels } from '../panels/panelLayout';

const DRAW_GROUPS: ToolId[][] = [
  ['select', 'direct', 'artboard'],
  ['pen', 'pencil'],
  ['rect', 'ellipse', 'polygon', 'star', 'line'],
  ['scissors', 'knife', 'corner', 'shapeBuilder'],
  ['text', 'image'],
  ['eyedropper', 'hand', 'zoom'],
];

const PHOTO_GROUPS: ToolId[][] = [
  ['select', 'straighten', 'perspective'],
  ['marqueeRect', 'marqueeEllipse', 'lasso', 'polyLasso', 'magicWand', 'quickSelect'],
  ['brush', 'eraser', 'fill'],
  ['magicEraser', 'heal', 'clone'],
  ['dodge', 'burn', 'blurBrush', 'sharpenBrush', 'smudge', 'liquify'],
  ['text'],
  ['eyedropper', 'hand', 'zoom'],
];

/** Outils d'une Persona, par groupe (pour la colonne et la boîte « Espace de travail »). */
export function toolGroupsFor(persona: Persona): ToolId[][] {
  return persona === 'photo' ? PHOTO_GROUPS : DRAW_GROUPS;
}

/** Au-delà de ce nombre d'outils, la colonne passe sur deux rangées (comme dans Affinity). */
const TWO_COLUMNS = 18;

const KEY_OF = Object.fromEntries(Object.entries(TOOL_KEYS).map(([k, v]) => [v, k.toUpperCase()]));
const PHOTO_KEY_OF = Object.fromEntries(
  Object.entries(PHOTO_TOOL_KEYS).map(([k, v]) => [v, k.toUpperCase()]),
);

export function ToolColumn() {
  const t = useT();
  const tool = useUi((s) => s.tool);
  const target = useUi((s) => s.colorTarget);
  const defaults = useUi((s) => s.defaults);
  const persona = useUi((s) => s.persona);
  const brushColor = useUi((s) => s.brushColor);
  const brushColor2 = useUi((s) => s.brushColor2);
  const { doc, selection } = useEditor();
  const photo = persona === 'photo';
  const allowed = useActiveWorkspace()?.tools ?? null;
  const groups = toolGroupsFor(persona)
    .map((g) => (allowed ? g.filter((id) => allowed.includes(id)) : g))
    .filter((g) => g.length > 0);
  const keys = photo ? PHOTO_KEY_OF : KEY_OF;
  const node = selection.length ? findNode(doc, selection[0])?.node : null;
  const styled = node && isStyled(node) ? node : null;
  const fill = styled ? styled.fill : defaults.fill;
  const stroke = styled ? styled.stroke.paint : defaults.stroke.paint;
  const floating = usePanels((s) => !!s.floating.tools);
  const side = useUi((s) => s.settings.toolsSide);
  const dropping = useUi((s) => s.panelDock === 'tools');
  const ref = useRef<HTMLDivElement>(null);
  const two = groups.flat().length > TWO_COLUMNS;
  const column = (
    <div
      ref={floating ? undefined : ref}
      className={`toolcol${two && !floating ? ' two' : ''}${floating ? ' floating' : ''}`}
      role="toolbar"
      aria-orientation={floating ? undefined : 'vertical'}
      aria-label={t('panel.tools')}
      data-testid="toolcol"
    >
      {!floating && (
        <div
          className="toolcol-grip panel-handle"
          title={t('panel.floatHint')}
          data-testid="toolcol-grip"
          onPointerDown={(e) => startPanelDrag(e, 'tools', ref.current)}
          onDoubleClick={() => {
            const r = ref.current!.getBoundingClientRect();
            startFloatAt(side === 'left' ? r.right + 24 : r.left - 140, r.top + 20, r.height);
          }}
        >
          <span className="panel-grip" aria-hidden="true" />
        </div>
      )}
      {groups.map((group, gi) => (
        <div className="toolgroup" key={gi}>
          {group.map((id) => {
            const label = `${t(`tool.${id}`)}${keys[id] ? ` (${keys[id]})` : ''}`;
            return (
              <button
                key={id}
                className="tool"
                aria-pressed={tool === id}
                title={label}
                aria-label={label}
                data-testid={`tool-${id}`}
                onClick={() => (id === 'image' ? void importImage() : setTool(id))}
              >
                <Icon name={id as IconName} />
              </button>
            );
          })}
        </div>
      ))}
      {photo ? (
        <div className="fillstroke">
          <button
            className="fs-stroke"
            style={{ background: brushColor2 }}
            title={t('ctx.secondary')}
            aria-label={t('ctx.secondary')}
            onClick={() => ui.set({ brushColor: brushColor2, brushColor2: brushColor })}
          />
          <button
            className="fs-fill on"
            style={{ background: brushColor }}
            title={t('ctx.primary')}
            aria-label={t('ctx.primary')}
            data-testid="brush-color"
          />
          <button
            className="fs-swap"
            title={t('ctx.swapColors')}
            aria-label={t('ctx.swapColors')}
            onClick={() => ui.set({ brushColor: brushColor2, brushColor2: brushColor })}
          >
            <Icon name="swap" size={12} />
          </button>
        </div>
      ) : (
        <div className="fillstroke">
          <button
            className={`fs-stroke${target === 'stroke' ? ' on' : ''}`}
            style={{ background: paintPreview(stroke) }}
            title={t('color.stroke')}
            aria-label={t('color.stroke')}
            onClick={() => ui.set({ colorTarget: 'stroke' })}
          />
          <button
            className={`fs-fill${target === 'fill' ? ' on' : ''}`}
            style={{ background: paintPreview(fill) }}
            title={t('color.fill')}
            aria-label={t('color.fill')}
            onClick={() => ui.set({ colorTarget: 'fill' })}
          />
          <button
            className="fs-swap"
            title={t('color.swap')}
            aria-label={t('color.swap')}
            onClick={() => {
              setPaint('fill', stroke);
              setPaint('stroke', fill);
            }}
          >
            <Icon name="swap" size={12} />
          </button>
        </div>
      )}
    </div>
  );
  if (!floating)
    return (
      <>
        {column}
        {dropping && <div className={`dock-band tools ${side}`} aria-hidden="true" />}
      </>
    );
  return (
    <FloatingFrame id="tools" label={t('panel.tools')} className="tools-float">
      <div
        ref={ref}
        className="float-head panel-handle"
        title={t('panel.dockHint')}
        onPointerDown={(e) => startPanelDrag(e, 'tools', ref.current?.parentElement ?? null)}
        onDoubleClick={() => dockPanel('tools')}
      >
        <span className="panel-grip" aria-hidden="true" />
        <button
          className="ib small"
          data-no-drag
          title={t('panel.dock')}
          aria-label={t('panel.dock')}
          data-testid="dock-tools"
          onClick={() => dockPanel('tools')}
        >
          <Icon name={side === 'left' ? 'sideLeft' : 'sideRight'} size={12} />
        </button>
      </div>
      {column}
    </FloatingFrame>
  );
}

/** Double-clic sur la poignée : la colonne devient une palette flottante de deux colonnes. */
function startFloatAt(x: number, y: number, h: number): void {
  floatPanel('tools', { x, y, w: 92, h: Math.min(h, 640) });
}
