import * as Menu from '@radix-ui/react-dropdown-menu';
import { COLOR_ADJUSTMENTS, LIVE_FILTERS, LUT_PRESETS, type LutPreset } from '@poulpe/core';
import { useT } from '../i18n';
import { addAdjustment, addAutoLevels } from '../photo/photoActions';
import { addLutPreset, loadLutFile } from '../photo/retouchActions';
import { Icon } from './Icon';

/** Bouton « Ajouter un réglage » : la liste des calques de réglage et des filtres dynamiques. */
export function AdjustmentMenu({ small }: { small?: boolean }) {
  const t = useT();
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className={small ? 'ib small' : 'ib'}
        title={t('layers.addAdjustment')}
        aria-label={t('layers.addAdjustment')}
        data-testid="add-adjustment"
      >
        <Icon name="adjust" size={small ? 14 : 16} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="start" sideOffset={4}>
          {COLOR_ADJUSTMENTS.map((k) => (
            <Menu.Item
              key={k}
              className="menu-item"
              onSelect={() => addAdjustment(k)}
              data-testid={`adjustment-${k}`}
            >
              <span className="menu-check" />
              <span className="menu-label">{t(`adjust.${k}`)}</span>
            </Menu.Item>
          ))}
          <Menu.Separator className="menu-sep" />
          {LIVE_FILTERS.map((k) => (
            <Menu.Item
              key={k}
              className="menu-item"
              onSelect={() => addAdjustment(k)}
              data-testid={`adjustment-${k}`}
            >
              <span className="menu-check" />
              <span className="menu-label">{t(`adjust.${k}`)}</span>
            </Menu.Item>
          ))}
          <Menu.Separator className="menu-sep" />
          {(Object.keys(LUT_PRESETS) as LutPreset[]).map((k) => (
            <Menu.Item
              key={k}
              className="menu-item"
              onSelect={() => addLutPreset(k)}
              data-testid={`lut-${k}`}
            >
              <span className="menu-check" />
              <span className="menu-label">{t(`lut.${k}`)}</span>
            </Menu.Item>
          ))}
          <Menu.Item className="menu-item" onSelect={() => void loadLutFile()}>
            <span className="menu-check" />
            <span className="menu-label">{t('lut.load')}</span>
          </Menu.Item>
          <Menu.Separator className="menu-sep" />
          <Menu.Item className="menu-item" onSelect={addAutoLevels}>
            <span className="menu-check" />
            <span className="menu-label">{t('adjust.auto')}</span>
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
