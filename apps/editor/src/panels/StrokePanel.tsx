import { findNode } from '@poulpe/core';
import { updateSelected } from '../actions';
import { NumberField, paintPreview } from '../components/fields';
import { useT } from '../i18n';
import { ui, useEditor, useUi } from '../store';

export function StrokePanel() {
  const t = useT();
  const { doc, selection } = useEditor();
  const defaults = useUi((s) => s.defaults);
  const node = selection.length ? findNode(doc, selection[0])?.node : null;
  const stroke = node && node.type !== 'group' && node.type !== 'image' ? node.stroke : defaults.stroke;
  return (
    <div className="panel-body">
      <div className="picker-row">
        <button
          className="chip ring big"
          style={{ background: paintPreview(stroke.paint) }}
          aria-label={t('color.stroke')}
          title={t('color.stroke')}
          onClick={() => ui.set({ colorTarget: 'stroke' })}
        />
        <NumberField
          label={t('stroke.width')}
          value={stroke.width}
          min={0}
          max={500}
          decimals={1}
          unit="px"
          width={120}
          testId="stroke-width"
          onChange={(w) =>
            node
              ? updateSelected(
                  'history.style',
                  (n) =>
                    void (n.type !== 'group' && n.type !== 'image' && (n.stroke = { ...n.stroke, width: w })),
                  { deep: true },
                )
              : ui.set({ defaults: { ...defaults, stroke: { ...defaults.stroke, width: w } } })
          }
        />
      </div>
    </div>
  );
}
