import {
  EFFECT_TYPES,
  alphaOf,
  defaultEffect,
  findEffect,
  findNode,
  opaque,
  withAlpha,
  type Effect,
  type EffectType,
} from '@poulpe/core';
import { NumberField, Select } from '../components/fields';
import { useT } from '../i18n';
import { editor, useEditor } from '../store';
import { setEffect } from '../vectorActions';

let commitTimer: ReturnType<typeof setTimeout> | undefined;

/** Panneau Effets : ombres, lueurs et flou de l'objet sélectionné, comme les effets de calque d'Affinity. */
export function EffectsPanel() {
  const t = useT();
  const { doc, selection } = useEditor();
  const node = selection.length ? findNode(doc, selection[0])?.node : null;
  if (!node) return <p className="panel-body note">{t('effects.none')}</p>;
  return (
    <div className="panel-body effects">
      {EFFECT_TYPES.map((type) => (
        <EffectRow key={type} type={type} effect={findEffect(node, type)} />
      ))}
    </div>
  );
}

function EffectRow({ type, effect }: { type: EffectType; effect: Effect | undefined }) {
  const t = useT();
  const on = !!effect?.enabled;
  const e = effect ?? defaultEffect(type);
  const set = (patch: Partial<Effect>) => setEffect(type, { ...patch, enabled: true } as Partial<Effect>);
  return (
    <div className={`effect-row${on ? ' on' : ''}`} data-testid={`effect-${type}`}>
      <label className="check">
        <input
          type="checkbox"
          checked={on}
          aria-label={t(`effects.${type}`)}
          onChange={(ev) => setEffect(type, ev.target.checked ? { ...e, enabled: true } : null)}
        />
        {t(`effects.${type}`)}
      </label>
      {on && (
        <div className="picker-row">
          {'color' in e && (
            <>
              <input
                type="color"
                className="color-input"
                aria-label={t('effects.color')}
                title={t('effects.color')}
                value={opaque(e.color)}
                onChange={(ev) => {
                  // Le sélecteur envoie une valeur à chaque mouvement : un seul pas d'historique.
                  setEffect(
                    type,
                    { color: withAlpha(ev.target.value, alphaOf(e.color)), enabled: true },
                    true,
                  );
                  clearTimeout(commitTimer);
                  commitTimer = setTimeout(() => editor.commit('history.effects'), 400);
                }}
              />
              <NumberField
                label={t('effects.opacity')}
                value={Math.round(alphaOf(e.color) * 100)}
                min={0}
                max={100}
                unit="%"
                width={70}
                onChange={(v) => set({ color: withAlpha(e.color, v / 100) })}
              />
            </>
          )}
          {(e.type === 'dropShadow' || e.type === 'innerShadow') && (
            <>
              <NumberField
                label="X"
                value={e.x}
                min={-500}
                max={500}
                unit="px"
                width={70}
                onChange={(x) => set({ x })}
              />
              <NumberField
                label="Y"
                value={e.y}
                min={-500}
                max={500}
                unit="px"
                width={70}
                onChange={(y) => set({ y })}
              />
            </>
          )}
          {'blur' in e && (
            <NumberField
              label={t('effects.softness')}
              value={e.blur}
              min={0}
              max={500}
              unit="px"
              width={70}
              testId={`effect-${type}-blur`}
              onChange={(blur) => set({ blur })}
            />
          )}
          {e.type === 'bevel' && (
            <>
              <Select
                label={t('effects.bevelStyle')}
                value={e.style}
                options={(['bevel', 'emboss'] as const).map((s) => ({
                  value: s,
                  label: t(`effects.bevel.${s}`),
                }))}
                onChange={(style) => set({ style })}
              />
              <NumberField
                label={t('effects.depth')}
                value={e.depth}
                min={0}
                max={100}
                unit="px"
                width={70}
                testId="effect-bevel-depth"
                onChange={(depth) => set({ depth })}
              />
              <NumberField
                label={t('effects.angle')}
                value={e.angle}
                min={-360}
                max={360}
                unit="°"
                width={70}
                onChange={(angle) => set({ angle })}
              />
              <NumberField
                label={t('effects.softness')}
                value={e.softness}
                min={0}
                max={100}
                unit="px"
                width={70}
                onChange={(softness) => set({ softness })}
              />
              <NumberField
                label={t('effects.intensity')}
                value={e.intensity}
                min={0}
                max={100}
                unit="%"
                width={70}
                onChange={(intensity) => set({ intensity })}
              />
              <input
                type="color"
                className="color-input"
                aria-label={t('effects.light')}
                title={t('effects.light')}
                value={opaque(e.light)}
                onChange={(ev) => set({ light: ev.target.value })}
              />
              <input
                type="color"
                className="color-input"
                aria-label={t('effects.shadow')}
                title={t('effects.shadow')}
                value={opaque(e.shadow)}
                onChange={(ev) => set({ shadow: ev.target.value })}
              />
            </>
          )}
          {e.type === 'blur' && (
            <NumberField
              label={t('effects.radius')}
              value={e.radius}
              min={0}
              max={500}
              unit="px"
              width={70}
              onChange={(radius) => set({ radius })}
            />
          )}
        </div>
      )}
    </div>
  );
}
