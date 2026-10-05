import { setPaint } from '../actions';
import { PHOTO_TOOL_KEYS, TOOL_KEYS } from '../commands';
import { useT } from '../i18n';
import { importImage } from '../io';
import { setTool, ui, useEditor, useUi, type ToolId } from '../store';
import { findNode, isStyled } from '@poulpe/core';
import { paintPreview } from './fields';
import { Icon, type IconName } from './Icon';

const GROUPS: ToolId[][] = [
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
  const keys = photo ? PHOTO_KEY_OF : KEY_OF;
  const node = selection.length ? findNode(doc, selection[0])?.node : null;
  const styled = node && isStyled(node) ? node : null;
  const fill = styled ? styled.fill : defaults.fill;
  const stroke = styled ? styled.stroke.paint : defaults.stroke.paint;
  return (
    <div
      className={`toolcol${(photo ? PHOTO_GROUPS : GROUPS).flat().length > TWO_COLUMNS ? ' two' : ''}`}
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Outils"
    >
      {(photo ? PHOTO_GROUPS : GROUPS).map((group, gi) => (
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
}
