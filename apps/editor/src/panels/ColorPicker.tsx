import { useEffect, useRef, useState } from 'react';
import {
  formatColor,
  hslToRgb,
  hsvToRgb,
  normalizeHex,
  parseColor,
  rgbToHsl,
  rgbToHsv,
  type HSVA,
} from '@poulpe/core';
import { NumberField } from '../components/fields';
import { useT } from '../i18n';

export type Phase = 'start' | 'move' | 'end' | 'set';

/** Sélecteur de couleur : carré saturation / luminosité, teinte, opacité, hexadécimal, RVB ou TSL. */
export function ColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string, phase: Phase) => void;
}) {
  const t = useT();
  const [hsv, setHsv] = useState<HSVA>(() => rgbToHsv(parseColor(color)));
  const [mode, setMode] = useState<'rgb' | 'hsl'>('rgb');
  const lastEmitted = useRef(color);

  // Couleur changée de l'extérieur (autre objet sélectionné, annulation…).
  useEffect(() => {
    if (color.toLowerCase() !== lastEmitted.current.toLowerCase()) {
      const next = rgbToHsv(parseColor(color));
      setHsv((prev) => ({ ...next, h: next.s === 0 || next.v === 0 ? prev.h : next.h }));
      lastEmitted.current = color;
    }
  }, [color]);

  const emit = (next: HSVA, phase: Phase) => {
    setHsv(next);
    const c = formatColor(hsvToRgb(next));
    lastEmitted.current = c;
    onChange(c, phase);
  };

  const drag = (el: HTMLElement, e: React.PointerEvent, fn: (x: number, y: number, phase: Phase) => void) => {
    const rect = el.getBoundingClientRect();
    const at = (ev: { clientX: number; clientY: number }) => [
      Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height)),
    ];
    el.setPointerCapture(e.pointerId);
    const [x, y] = at(e);
    fn(x, y, 'start');
    const move = (ev: PointerEvent) => {
      const [mx, my] = at(ev);
      fn(mx, my, 'move');
    };
    const up = (ev: PointerEvent) => {
      const [ux, uy] = at(ev);
      fn(ux, uy, 'end');
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const rgb = hsvToRgb(hsv);
  const hsl = rgbToHsl(rgb);
  const opaqueHex = formatColor({ ...rgb, a: 1 });
  const hueColor = formatColor(hsvToRgb({ h: hsv.h, s: 1, v: 1, a: 1 }));

  return (
    <div className="picker">
      <div
        className="sv"
        style={{ background: hueColor }}
        role="slider"
        aria-label="Saturation"
        aria-valuenow={Math.round(hsv.s * 100)}
        tabIndex={0}
        onPointerDown={(e) =>
          drag(e.currentTarget, e, (x, y, phase) => emit({ ...hsv, s: x, v: 1 - y, a: hsv.a }, phase))
        }
        onKeyDown={(e) => {
          const d = e.shiftKey ? 0.1 : 0.01;
          if (e.key === 'ArrowRight') emit({ ...hsv, s: Math.min(1, hsv.s + d) }, 'set');
          if (e.key === 'ArrowLeft') emit({ ...hsv, s: Math.max(0, hsv.s - d) }, 'set');
          if (e.key === 'ArrowUp') emit({ ...hsv, v: Math.min(1, hsv.v + d) }, 'set');
          if (e.key === 'ArrowDown') emit({ ...hsv, v: Math.max(0, hsv.v - d) }, 'set');
        }}
      >
        <div className="sv-white" />
        <div className="sv-black" />
        <div
          className="sv-knob"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: opaqueHex }}
        />
      </div>
      <div
        className="slider hue"
        role="slider"
        aria-label="Teinte"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        tabIndex={0}
        onPointerDown={(e) =>
          drag(e.currentTarget, e, (x, _y, phase) => emit({ ...hsv, h: x * 359.9 }, phase))
        }
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight')
            emit({ ...hsv, h: Math.min(359.9, hsv.h + (e.shiftKey ? 10 : 1)) }, 'set');
          if (e.key === 'ArrowLeft') emit({ ...hsv, h: Math.max(0, hsv.h - (e.shiftKey ? 10 : 1)) }, 'set');
        }}
      >
        <div className="slider-knob" style={{ left: `${(hsv.h / 360) * 100}%` }} />
      </div>
      <div
        className="slider alpha"
        role="slider"
        aria-label={t('color.opacity')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hsv.a * 100)}
        tabIndex={0}
        style={{ ['--c' as string]: opaqueHex }}
        onPointerDown={(e) =>
          drag(e.currentTarget, e, (x, _y, phase) => emit({ ...hsv, a: Math.round(x * 100) / 100 }, phase))
        }
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') emit({ ...hsv, a: Math.min(1, hsv.a + 0.01) }, 'set');
          if (e.key === 'ArrowLeft') emit({ ...hsv, a: Math.max(0, hsv.a - 0.01) }, 'set');
        }}
      >
        <div className="slider-knob" style={{ left: `${hsv.a * 100}%` }} />
      </div>
      <div className="picker-row">
        <HexField
          value={opaqueHex}
          onChange={(hex) => {
            const c = rgbToHsv(parseColor(hex));
            emit({ ...c, a: hsv.a }, 'set');
          }}
        />
        <NumberField
          label={t('color.opacity')}
          value={Math.round(hsv.a * 100)}
          min={0}
          max={100}
          unit="%"
          width={100}
          onChange={(v) => emit({ ...hsv, a: v / 100 }, 'set')}
        />
      </div>
      <div className="picker-row">
        <div className="seg small" role="group">
          <button aria-pressed={mode === 'rgb'} onClick={() => setMode('rgb')}>
            {t('color.rgb')}
          </button>
          <button aria-pressed={mode === 'hsl'} onClick={() => setMode('hsl')}>
            {t('color.hsl')}
          </button>
        </div>
        {mode === 'rgb' ? (
          <>
            {(['r', 'g', 'b'] as const).map((k) => (
              <NumberField
                key={k}
                label={k.toUpperCase()}
                value={Math.round(rgb[k])}
                min={0}
                max={255}
                width={56}
                onChange={(v) => emit({ ...rgbToHsv({ ...rgb, [k]: v }), a: hsv.a }, 'set')}
              />
            ))}
          </>
        ) : (
          <>
            <NumberField
              label={t('color.hsl')[0]}
              value={Math.round(hsl.h)}
              min={0}
              max={360}
              width={56}
              onChange={(v) => emit({ ...rgbToHsv(hslToRgb(v, hsl.s, hsl.l)), a: hsv.a }, 'set')}
            />
            <NumberField
              label={t('color.hsl')[1]}
              value={Math.round(hsl.s * 100)}
              min={0}
              max={100}
              width={56}
              onChange={(v) => emit({ ...rgbToHsv(hslToRgb(hsl.h, v / 100, hsl.l)), a: hsv.a }, 'set')}
            />
            <NumberField
              label={t('color.hsl')[2]}
              value={Math.round(hsl.l * 100)}
              min={0}
              max={100}
              width={56}
              onChange={(v) => emit({ ...rgbToHsv(hslToRgb(hsl.h, hsl.s, v / 100)), a: hsv.a }, 'set')}
            />
          </>
        )}
      </div>
    </div>
  );
}

function HexField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const t = useT();
  const [text, setText] = useState(value.slice(1).toUpperCase());
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value.slice(1).toUpperCase());
  }, [value, focused]);
  const commit = () => {
    const hex = normalizeHex(text);
    if (hex) onChange(hex);
    else setText(value.slice(1).toUpperCase());
  };
  return (
    <label className="field hex">
      <span className="field-label">#</span>
      <input
        className="num"
        value={text}
        aria-label={t('color.hex')}
        data-testid="hex-input"
        maxLength={9}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}
