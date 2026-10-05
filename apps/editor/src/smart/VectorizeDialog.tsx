import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_TRACE,
  TRACE_PRESETS,
  type TraceOptions,
  type TracePreset,
  type TraceResult,
} from '@poulpe/core';
import { Modal } from '../components/Dialogs';
import { Select } from '../components/fields';
import { Slider } from '../components/PhotoContext';
import { useT } from '../i18n';
import { selectedImage } from '../photo/pixels';
import { ui } from '../store';
import { insertTrace, traceAsync, traceNodeCount, traceSource, traceToSvg } from './vectorize';

const close = () => ui.set({ dialog: null });

const PRECISION = { low: 500, medium: 1000, high: 2000 } as const;
type Precision = keyof typeof PRECISION;

/** Vectoriser l'image : préréglages, réglages fins, aperçu côte à côte avant de valider. */
export function VectorizeDialog() {
  const t = useT();
  const node = useMemo(() => selectedImage(), []);
  const [preset, setPreset] = useState<TracePreset | 'custom'>('logo');
  const [opts, setOpts] = useState<TraceOptions>({ ...DEFAULT_TRACE, ...TRACE_PRESETS.logo });
  const [precision, setPrecision] = useState<Precision>('medium');
  const [original, setOriginal] = useState<'hide' | 'keep' | 'delete'>('hide');
  const [result, setResult] = useState<TraceResult | null>(null);
  const [working, setWorking] = useState(false);
  const generation = useRef(0);

  const source = useMemo(() => (node ? traceSource(node, PRECISION[precision]) : null), [node, precision]);
  const sourceUrl = useMemo(() => {
    if (!source) return '';
    const c = document.createElement('canvas');
    const k = Math.min(1, 480 / Math.max(source.width, source.height));
    c.width = Math.max(1, Math.round(source.width * k));
    c.height = Math.max(1, Math.round(source.height * k));
    const tmp = document.createElement('canvas');
    tmp.width = source.width;
    tmp.height = source.height;
    tmp.getContext('2d')!.putImageData(source, 0, 0);
    c.getContext('2d')!.drawImage(tmp, 0, 0, c.width, c.height);
    return c.toDataURL();
  }, [source]);

  useEffect(() => {
    if (!source) return;
    const gen = ++generation.current;
    const timer = setTimeout(() => {
      setWorking(true);
      traceAsync(source, opts)
        .then((r) => {
          if (gen === generation.current) setResult(r);
        })
        .catch((e) => console.error(e))
        .finally(() => gen === generation.current && setWorking(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [source, opts]);

  const resultUrl = useMemo(
    () => (result ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(traceToSvg(result))}` : ''),
    [result],
  );

  if (!node) return null;
  const set = (patch: Partial<TraceOptions>) => {
    setPreset('custom');
    setOpts((o) => ({ ...o, ...patch }));
  };
  const presets = Object.keys(TRACE_PRESETS) as TracePreset[];

  return (
    <Modal title={t('vectorize.title')} onClose={close} wide>
      <div className="trace-previews">
        <figure>
          <img src={sourceUrl} alt="" />
          <figcaption>{t('vectorize.before')}</figcaption>
        </figure>
        <figure className={working ? 'working' : ''}>
          {resultUrl ? (
            <img src={resultUrl} alt="" data-testid="trace-preview" />
          ) : (
            <div className="trace-wait" />
          )}
          <figcaption>
            {result
              ? t('vectorize.stats', { colors: result.layers.length, nodes: traceNodeCount(result) })
              : t('vectorize.working')}
          </figcaption>
        </figure>
      </div>
      <div className="picker-row">
        <Select
          label={t('vectorize.preset')}
          value={preset}
          testId="trace-preset"
          options={[
            ...presets.map((p) => ({
              value: p as TracePreset | 'custom',
              label: t(`vectorize.preset.${p}`),
            })),
            { value: 'custom', label: t('vectorize.preset.custom') },
          ]}
          onChange={(p) => {
            setPreset(p);
            if (p !== 'custom') setOpts({ ...DEFAULT_TRACE, ...TRACE_PRESETS[p] });
          }}
        />
        <Select
          label={t('vectorize.mode')}
          value={opts.mode}
          options={(['color', 'gray', 'bw'] as const).map((m) => ({
            value: m,
            label: t(`vectorize.mode.${m}`),
          }))}
          onChange={(mode) => set({ mode })}
        />
        <Select
          label={t('vectorize.precision')}
          value={precision}
          options={(['low', 'medium', 'high'] as const).map((p) => ({
            value: p,
            label: t(`vectorize.precision.${p}`),
          }))}
          onChange={setPrecision}
        />
      </div>
      <div className="trace-sliders">
        {opts.mode === 'bw' ? (
          <Slider
            label={t('vectorize.threshold')}
            value={opts.threshold}
            min={1}
            max={254}
            onChange={(threshold) => set({ threshold })}
          />
        ) : (
          <Slider
            label={t('vectorize.colors')}
            value={opts.colors}
            min={2}
            max={64}
            testId="trace-colors"
            onChange={(colors) => set({ colors })}
          />
        )}
        <Slider
          label={t('vectorize.noise')}
          value={opts.noise}
          min={1}
          max={200}
          unit="px"
          onChange={(noise) => set({ noise })}
        />
        <Slider
          label={t('vectorize.smoothness')}
          value={Math.round(opts.tolerance * 10)}
          min={2}
          max={50}
          onChange={(v) => set({ tolerance: v / 10 })}
        />
        <Slider
          label={t('vectorize.corners')}
          value={opts.cornerAngle}
          min={10}
          max={150}
          unit="°"
          onChange={(cornerAngle) => set({ cornerAngle })}
        />
      </div>
      <div className="picker-row">
        <label className="check">
          <input
            type="checkbox"
            checked={opts.ignoreWhite}
            onChange={(e) => set({ ignoreWhite: e.target.checked })}
          />
          {t('vectorize.ignoreWhite')}
        </label>
        <Select
          label={t('vectorize.original')}
          value={original}
          options={(['hide', 'keep', 'delete'] as const).map((o) => ({
            value: o,
            label: t(`vectorize.original.${o}`),
          }))}
          onChange={setOriginal}
        />
      </div>
      <footer>
        <button className="btn" onClick={close}>
          {t('new.cancel')}
        </button>
        <button
          className="btn primary"
          data-testid="trace-apply"
          disabled={!result || working}
          onClick={() => {
            if (!result) return;
            close();
            insertTrace(node.id, result, original);
          }}
        >
          {t('vectorize.go')}
        </button>
      </footer>
    </Modal>
  );
}
