import { FORMAT_PRESETS, findArtboard, findNode, type SceneNode } from '@poulpe/core';
import { setPaint, setTextStyle, updateArtboard, updateSelected } from '../actions';
import { useFonts } from '../fonts';
import { useT } from '../i18n';
import { ui, useEditor, useUi, type ToolId } from '../store';
import { NumberField, Select, paintPreview } from './fields';

const SHAPES: ToolId[] = ['rect', 'ellipse', 'polygon', 'star', 'line'];

function PaintSwatches({ node }: { node: SceneNode | null }) {
  const t = useT();
  const defaults = useUi((s) => s.defaults);
  const target = useUi((s) => s.colorTarget);
  const fill = node && node.type !== 'group' && node.type !== 'image' ? node.fill : defaults.fill;
  const stroke = node && node.type !== 'group' && node.type !== 'image' ? node.stroke : defaults.stroke;
  const setWidth = (w: number) => {
    if (node)
      updateSelected(
        'history.style',
        (n) => void (n.type !== 'group' && n.type !== 'image' && (n.stroke = { ...n.stroke, width: w })),
        { deep: true },
      );
    else ui.set({ defaults: { ...defaults, stroke: { ...defaults.stroke, width: w } } });
  };
  return (
    <>
      <span className="ctx-label">{t('ctx.fill')}</span>
      <button
        className={`chip${target === 'fill' ? ' on' : ''}`}
        style={{ background: paintPreview(fill) }}
        aria-label={t('ctx.fill')}
        title={t('ctx.fill')}
        onClick={() => ui.set({ colorTarget: 'fill' })}
        onDoubleClick={() => setPaint('fill', { type: 'none' })}
      />
      <span className="ctx-label">{t('ctx.stroke')}</span>
      <button
        className={`chip ring${target === 'stroke' ? ' on' : ''}`}
        style={{ background: paintPreview(stroke.paint) }}
        aria-label={t('ctx.stroke')}
        title={t('ctx.stroke')}
        onClick={() => ui.set({ colorTarget: 'stroke' })}
      />
      <NumberField
        value={stroke.width}
        min={0}
        max={500}
        step={1}
        unit="px"
        width={96}
        onChange={setWidth}
        label={t('stroke.width')}
      />
    </>
  );
}

export function ContextBar() {
  const t = useT();
  const { doc, selection, activeArtboardId } = useEditor();
  const tool = useUi((s) => s.tool);
  const defaults = useUi((s) => s.defaults);
  const fonts = useFonts();
  const node = selection.length === 1 ? (findNode(doc, selection[0])?.node ?? null) : null;
  const ab = findArtboard(doc, activeArtboardId);

  const toolName = t(`tool.${tool}`);
  let content: React.ReactNode;

  if (tool === 'artboard' && ab) {
    const preset = FORMAT_PRESETS.find((f) => f.width === ab.width && f.height === ab.height)?.id ?? 'custom';
    content = (
      <>
        <span className="ctx-dim">{ab.name}</span>
        <Select
          label={t('ctx.artboardFormat')}
          value={preset}
          options={[
            { value: 'custom', label: t('new.custom') },
            ...FORMAT_PRESETS.map((f) => ({
              value: f.id,
              label: `${t(`format.${f.id}`)} · ${f.width} × ${f.height}`,
            })),
          ]}
          onChange={(id) => {
            const f = FORMAT_PRESETS.find((p) => p.id === id);
            if (f) updateArtboard(ab.id, { width: f.width, height: f.height });
          }}
        />
        <NumberField
          label={t('transform.w')}
          value={ab.width}
          min={1}
          max={20000}
          unit="px"
          width={90}
          onChange={(v) => updateArtboard(ab.id, { width: v })}
        />
        <NumberField
          label={t('transform.h')}
          value={ab.height}
          min={1}
          max={20000}
          unit="px"
          width={90}
          onChange={(v) => updateArtboard(ab.id, { height: v })}
        />
        <span className="ctx-label">{t('document.background')}</span>
        <button
          className="chip"
          style={{ background: paintPreview(ab.background) }}
          aria-label={t('document.background')}
          onClick={() => {
            const cur = ab.background;
            updateArtboard(ab.id, {
              background: cur.type === 'none' ? { type: 'solid', color: '#ffffff' } : { type: 'none' },
            });
          }}
        />
      </>
    );
  } else if (node || SHAPES.includes(tool) || tool === 'text' || (!selection.length && tool === 'select')) {
    const showNew = !selection.length;
    const kind: string = node?.type ?? (tool === 'text' ? 'text' : tool);
    const shape = node ?? null;
    content = (
      <>
        <span className="ctx-dim">
          {selection.length > 1
            ? t('ctx.selected', { n: selection.length })
            : node
              ? node.name
              : showNew && tool !== 'select'
                ? t('ctx.newObjects')
                : t('ctx.noSelection')}
        </span>
        {(node || tool !== 'select' || !selection.length) && <PaintSwatches node={node} />}
        {kind === 'rect' && (
          <NumberField
            label={t('ctx.cornerRadius')}
            value={shape?.type === 'rect' ? shape.cornerRadius : defaults.cornerRadius}
            min={0}
            unit="px"
            width={84}
            onChange={(v) =>
              shape
                ? updateSelected('history.style', (n) => void (n.type === 'rect' && (n.cornerRadius = v)))
                : ui.set({ defaults: { ...defaults, cornerRadius: v } })
            }
          />
        )}
        {kind === 'polygon' && (
          <NumberField
            label={t('ctx.sides')}
            value={shape?.type === 'polygon' ? shape.sides : defaults.sides}
            min={3}
            max={64}
            width={70}
            onChange={(v) =>
              shape
                ? updateSelected(
                    'history.style',
                    (n) => void (n.type === 'polygon' && (n.sides = Math.round(v))),
                  )
                : ui.set({ defaults: { ...defaults, sides: Math.round(v) } })
            }
          />
        )}
        {kind === 'star' && (
          <>
            <NumberField
              label={t('ctx.points')}
              value={shape?.type === 'star' ? shape.points : defaults.points}
              min={3}
              max={64}
              width={70}
              onChange={(v) =>
                shape
                  ? updateSelected(
                      'history.style',
                      (n) => void (n.type === 'star' && (n.points = Math.round(v))),
                    )
                  : ui.set({ defaults: { ...defaults, points: Math.round(v) } })
              }
            />
            <NumberField
              label={t('ctx.innerRatio')}
              value={Math.round((shape?.type === 'star' ? shape.innerRatio : defaults.innerRatio) * 100)}
              min={5}
              max={100}
              unit="%"
              width={84}
              onChange={(v) =>
                shape
                  ? updateSelected(
                      'history.style',
                      (n) => void (n.type === 'star' && (n.innerRatio = v / 100)),
                    )
                  : ui.set({ defaults: { ...defaults, innerRatio: v / 100 } })
              }
            />
          </>
        )}
        {kind === 'text' && (
          <>
            <Select
              label={t('char.font')}
              value={shape?.type === 'text' ? shape.style.fontFamily : defaults.text.fontFamily}
              options={fonts.map((f) => ({ value: f, label: f }))}
              onChange={(f) => setTextStyle({ fontFamily: f })}
              width={160}
            />
            <NumberField
              label={t('char.size')}
              value={shape?.type === 'text' ? shape.style.fontSize : defaults.text.fontSize}
              min={1}
              max={2000}
              unit="px"
              decimals={1}
              width={80}
              onChange={(v) => setTextStyle({ fontSize: v })}
            />
          </>
        )}
      </>
    );
  }

  return (
    <div className="contextbar" role="region" aria-label={toolName}>
      <b className="ctx-tool">{toolName}</b>
      {content}
    </div>
  );
}
