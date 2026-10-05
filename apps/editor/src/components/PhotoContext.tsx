import { findNode } from '@poulpe/core';
import { useT } from '../i18n';
import { isPhotoTool } from '../photo/photoTools';
import {
  brushSettings,
  isBrushTool,
  setBrush,
  ui,
  useEditor,
  useUi,
  type SelectionMode,
  type ToolId,
} from '../store';
import { Icon, type IconName } from './Icon';
import { NumberField } from './fields';

const MODES: { id: SelectionMode; icon: IconName; label: string }[] = [
  { id: 'replace', icon: 'modeReplace', label: 'ctx.modeReplace' },
  { id: 'add', icon: 'modeAdd', label: 'ctx.modeAdd' },
  { id: 'subtract', icon: 'modeSubtract', label: 'ctx.modeSubtract' },
  { id: 'intersect', icon: 'modeIntersect', label: 'ctx.modeIntersect' },
];

/** Curseur et champ numérique côte à côte (taille, dureté, opacité…). */
export function Slider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
  testId?: string;
}) {
  return (
    <span className="pslider">
      <span className="field-label">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        data-testid={testId}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <NumberField value={value} min={min} max={max} unit={unit} width={60} onChange={onChange} />
    </span>
  );
}

function ModeButtons() {
  const t = useT();
  const mode = useUi((s) => s.selectionMode);
  return (
    <span className="seg" role="group" aria-label={t('ctx.mode')}>
      {MODES.map((m) => (
        <button
          key={m.id}
          className="ib small"
          aria-pressed={mode === m.id}
          title={t(m.label)}
          aria-label={t(m.label)}
          onClick={() => ui.set({ selectionMode: m.id })}
        >
          <Icon name={m.icon} size={14} />
        </button>
      ))}
    </span>
  );
}

function BrushFields({ tool }: { tool: ToolId }) {
  const t = useT();
  useUi((s) => s.brushes);
  const b = brushSettings(tool);
  const retouch = tool === 'dodge' || tool === 'burn' || tool === 'blurBrush' || tool === 'sharpenBrush';
  return (
    <>
      <Slider
        label={t('ctx.size')}
        value={b.size}
        min={1}
        max={1000}
        unit="px"
        testId="brush-size"
        onChange={(size) => setBrush({ size }, tool)}
      />
      {tool !== 'magicEraser' && (
        <>
          <Slider
            label={t('ctx.hardness')}
            value={b.hardness}
            min={0}
            max={100}
            unit="%"
            onChange={(hardness) => setBrush({ hardness }, tool)}
          />
          <Slider
            label={t(retouch ? 'ctx.strength' : 'ctx.opacity')}
            value={b.opacity}
            min={1}
            max={100}
            unit="%"
            testId="brush-opacity"
            onChange={(opacity) => setBrush({ opacity }, tool)}
          />
          <Slider
            label={t('ctx.flow')}
            value={b.flow}
            min={1}
            max={100}
            unit="%"
            onChange={(flow) => setBrush({ flow }, tool)}
          />
        </>
      )}
    </>
  );
}

/** Barre contextuelle des outils de la Persona Photo. */
export function PhotoContext({ tool }: { tool: ToolId }) {
  const t = useT();
  const feather = useUi((s) => s.feather);
  const tolerance = useUi((s) => s.tolerance);
  const contiguous = useUi((s) => s.contiguous);
  const maskEditId = useUi((s) => s.maskEditId);
  const color = useUi((s) => s.brushColor);
  const { doc } = useEditor();
  const maskNode = maskEditId ? findNode(doc, maskEditId)?.node : null;
  if (!isPhotoTool(tool)) return null;
  const select =
    tool === 'marqueeRect' || tool === 'marqueeEllipse' || tool === 'lasso' || tool === 'magicWand';
  return (
    <>
      {(isBrushTool(tool) || tool === 'fill') && tool !== 'magicEraser' && (
        <label className="field">
          <span className="field-label">{t('ctx.primary')}</span>
          <input
            type="color"
            className="color-input"
            value={color.slice(0, 7)}
            aria-label={t('ctx.primary')}
            onChange={(e) => ui.set({ brushColor: e.target.value })}
          />
        </label>
      )}
      {select && <ModeButtons />}
      {(tool === 'marqueeRect' || tool === 'marqueeEllipse' || tool === 'lasso') && (
        <NumberField
          label={t('ctx.feather')}
          value={feather}
          min={0}
          max={500}
          unit="px"
          width={70}
          onChange={(v) => ui.set({ feather: v })}
        />
      )}
      {(tool === 'magicWand' || tool === 'fill') && (
        <>
          <Slider
            label={t('ctx.tolerance')}
            value={tolerance}
            min={0}
            max={255}
            testId="tolerance"
            onChange={(v) => ui.set({ tolerance: v })}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={contiguous}
              onChange={(e) => ui.set({ contiguous: e.target.checked })}
            />
            {t('ctx.contiguous')}
          </label>
        </>
      )}
      {isBrushTool(tool) && <BrushFields tool={tool} />}
      {tool === 'fill' && (
        <Slider
          label={t('ctx.opacity')}
          value={brushSettings('brush').opacity}
          min={1}
          max={100}
          unit="%"
          onChange={(opacity) => setBrush({ opacity }, 'brush')}
        />
      )}
      {tool === 'clone' && <span className="ctx-dim">{t('ctx.cloneHint')}</span>}
      {tool === 'magicEraser' && <span className="ctx-dim">{t('ctx.magicEraserHint')}</span>}
      {maskNode && (isBrushTool(tool) || tool === 'fill') && (
        <span className="mask-badge" data-testid="mask-badge">
          {t('ctx.paintingMask', { name: maskNode.name })} · {t('ctx.maskHint')}
          <button className="btn small" onClick={() => ui.set({ maskEditId: null })}>
            {t('ctx.stopMask')}
          </button>
        </span>
      )}
    </>
  );
}
