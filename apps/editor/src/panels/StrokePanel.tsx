import { ARROW_HEADS, findNode, type ArrowHead, type Stroke } from '@poulpe/core';
import { updateSelected } from '../actions';
import { NumberField, Select, paintPreview } from '../components/fields';
import { useT } from '../i18n';
import { ui, useEditor, useUi } from '../store';
import { setStroke } from '../vectorActions';

/** Motifs de pointillés prêts à l'emploi, en multiples de l'épaisseur du trait. */
const DASHES: { id: string; dash: number[] | undefined; cap?: Stroke['cap'] }[] = [
  { id: 'solid', dash: undefined },
  { id: 'dashed', dash: [3, 2] },
  { id: 'dotted', dash: [0, 2], cap: 'round' },
  { id: 'long', dash: [6, 3] },
  { id: 'dashDot', dash: [4, 2, 0, 2], cap: 'round' },
];

export function StrokePanel() {
  const t = useT();
  const { doc, selection } = useEditor();
  const defaults = useUi((s) => s.defaults);
  const node = selection.length ? findNode(doc, selection[0])?.node : null;
  const stroke = node && node.type !== 'group' && node.type !== 'image' ? node.stroke : defaults.stroke;
  const preset = DASHES.find((d) => JSON.stringify(d.dash) === JSON.stringify(stroke.dash))?.id ?? 'custom';
  const dash = stroke.dash ?? [3, 2];
  return (
    <div className="panel-body stroke-panel">
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
      <div className="picker-row">
        <Select
          label={t('stroke.style')}
          value={preset}
          options={[
            ...DASHES.map((d) => ({ value: d.id, label: t(`stroke.dash.${d.id}`) })),
            ...(preset === 'custom' ? [{ value: 'custom', label: t('stroke.dash.custom') }] : []),
          ]}
          onChange={(id) => {
            const d = DASHES.find((x) => x.id === id);
            if (d) setStroke({ dash: d.dash, ...(d.cap ? { cap: d.cap } : {}) });
          }}
        />
        {stroke.dash && (
          <>
            <NumberField
              label={t('stroke.dashLength')}
              value={dash[0]}
              min={0}
              max={100}
              decimals={1}
              width={70}
              onChange={(v) => setStroke({ dash: [v, ...dash.slice(1)] })}
            />
            <NumberField
              label={t('stroke.gap')}
              value={dash[1] ?? dash[0]}
              min={0}
              max={100}
              decimals={1}
              width={70}
              onChange={(v) => setStroke({ dash: [dash[0], v, ...dash.slice(2)] })}
            />
          </>
        )}
      </div>
      <div className="picker-row">
        <Select
          label={t('stroke.cap')}
          value={stroke.cap ?? 'round'}
          options={(['butt', 'round', 'square'] as const).map((c) => ({
            value: c,
            label: t(`stroke.cap.${c}`),
          }))}
          onChange={(cap) => setStroke({ cap })}
        />
        <Select
          label={t('stroke.join')}
          value={stroke.join ?? 'round'}
          options={(['miter', 'round', 'bevel'] as const).map((j) => ({
            value: j,
            label: t(`stroke.join.${j}`),
          }))}
          onChange={(join) => setStroke({ join })}
        />
      </div>
      <div className="picker-row">
        <Select<ArrowHead>
          label={t('stroke.start')}
          value={stroke.start ?? 'none'}
          options={ARROW_HEADS.map((a) => ({ value: a, label: t(`stroke.arrow.${a}`) }))}
          onChange={(start) => setStroke({ start: start === 'none' ? undefined : start })}
        />
        <Select<ArrowHead>
          label={t('stroke.end')}
          value={stroke.end ?? 'none'}
          options={ARROW_HEADS.map((a) => ({ value: a, label: t(`stroke.arrow.${a}`) }))}
          onChange={(end) => setStroke({ end: end === 'none' ? undefined : end })}
        />
      </div>
      <p className="note small">{t('stroke.arrowHint')}</p>
    </div>
  );
}
