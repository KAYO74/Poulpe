import { setPaint } from '../actions';
import { TOOL_KEYS } from '../commands';
import { useT } from '../i18n';
import { importImage } from '../io';
import { setTool, ui, useEditor, useUi, type ToolId } from '../store';
import { findNode } from '@poulpe/core';
import { paintPreview } from './fields';
import { Icon, type IconName } from './Icon';

const GROUPS: ToolId[][] = [
  ['select', 'direct', 'artboard'],
  ['pen', 'pencil'],
  ['rect', 'ellipse', 'polygon', 'star', 'line'],
  ['text', 'image'],
  ['eyedropper', 'hand', 'zoom'],
];

const KEY_OF = Object.fromEntries(Object.entries(TOOL_KEYS).map(([k, v]) => [v, k.toUpperCase()]));

export function ToolColumn() {
  const t = useT();
  const tool = useUi((s) => s.tool);
  const target = useUi((s) => s.colorTarget);
  const defaults = useUi((s) => s.defaults);
  const { doc, selection } = useEditor();
  const node = selection.length ? findNode(doc, selection[0])?.node : null;
  const styled = node && node.type !== 'group' && node.type !== 'image' ? node : null;
  const fill = styled ? styled.fill : defaults.fill;
  const stroke = styled ? styled.stroke.paint : defaults.stroke.paint;
  return (
    <div className="toolcol" role="toolbar" aria-orientation="vertical" aria-label="Outils">
      {GROUPS.map((group, gi) => (
        <div className="toolgroup" key={gi}>
          {group.map((id) => {
            const label = `${t(`tool.${id}`)}${KEY_OF[id] ? ` (${KEY_OF[id]})` : ''}`;
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
    </div>
  );
}
