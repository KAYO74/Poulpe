import * as Menu from '@radix-ui/react-dropdown-menu';
import { FORMAT_PRESETS } from '@poulpe/core';
import { addArtboard } from '../actions';
import { COMMANDS, formatShortcut, type CommandId } from '../commands';
import { exportDocument } from '../io';
import { getLang, setLang, useT } from '../i18n';
import { setSettings, useEditor, useUi } from '../store';
import { Icon } from './Icon';

function Item({ id, checked }: { id: CommandId; checked?: boolean }) {
  const t = useT();
  const cmd = COMMANDS[id] as (typeof COMMANDS)[CommandId] & { enabled?: () => boolean; shortcut?: string };
  const enabled = !cmd.enabled || cmd.enabled();
  return (
    <Menu.Item className="menu-item" disabled={!enabled} onSelect={() => cmd.run()}>
      <span className="menu-check">{checked ? '✓' : ''}</span>
      <span className="menu-label">{t(cmd.label)}</span>
      {cmd.shortcut && <span className="menu-shortcut">{formatShortcut(cmd.shortcut)}</span>}
    </Menu.Item>
  );
}

function Top({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger className="menubar-trigger">{label}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="start" sideOffset={2}>
          {children}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

const Sep = () => <Menu.Separator className="menu-sep" />;

function Sub({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Menu.Sub>
      <Menu.SubTrigger className="menu-item">
        <span className="menu-check" />
        <span className="menu-label">{label}</span>
        <Icon name="chevron" size={12} />
      </Menu.SubTrigger>
      <Menu.Portal>
        <Menu.SubContent className="menu" sideOffset={4}>
          {children}
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  );
}

export function MenuBar() {
  const t = useT();
  const settings = useUi((s) => s.settings);
  const { activeArtboardId } = useEditor();
  const quickExport = (kind: 'png' | 'jpeg' | 'svg' | 'pdf') =>
    void exportDocument({
      kind,
      artboardId: kind === 'pdf' ? 'all' : activeArtboardId,
      scale: 1,
      quality: 0.92,
      transparent: false,
    });
  return (
    <nav className="menubar" aria-label="Menu">
      <Top label={t('menu.file')}>
        <Item id="file.new" />
        <Item id="file.open" />
        <Sep />
        <Item id="file.save" />
        <Item id="file.saveAs" />
        <Sep />
        <Item id="file.importImage" />
        <Sep />
        <Item id="file.export" />
        <Sub label={t('file.export')}>
          {(['png', 'jpeg', 'svg', 'pdf'] as const).map((k) => (
            <Menu.Item key={k} className="menu-item" onSelect={() => quickExport(k)}>
              <span className="menu-check" />
              <span className="menu-label">
                {t(`file.export${k === 'png' ? 'Png' : k === 'jpeg' ? 'Jpeg' : k === 'svg' ? 'Svg' : 'Pdf'}`)}
              </span>
            </Menu.Item>
          ))}
        </Sub>
      </Top>
      <Top label={t('menu.edit')}>
        <Item id="edit.undo" />
        <Item id="edit.redo" />
        <Sep />
        <Item id="edit.cut" />
        <Item id="edit.copy" />
        <Item id="edit.paste" />
        <Item id="edit.duplicate" />
        <Item id="edit.delete" />
        <Sep />
        <Item id="edit.selectAll" />
        <Item id="edit.deselect" />
      </Top>
      <Top label={t('menu.layer')}>
        <Item id="layer.group" />
        <Item id="layer.ungroup" />
        <Item id="layer.clip" />
        <Sep />
        <Item id="layer.lock" />
        <Item id="layer.hide" />
      </Top>
      <Top label={t('menu.arrange')}>
        <Item id="arrange.front" />
        <Item id="arrange.forward" />
        <Item id="arrange.backward" />
        <Item id="arrange.back" />
        <Sep />
        <Item id="arrange.alignLeft" />
        <Item id="arrange.alignHCenter" />
        <Item id="arrange.alignRight" />
        <Item id="arrange.alignTop" />
        <Item id="arrange.alignVCenter" />
        <Item id="arrange.alignBottom" />
        <Sep />
        <Item id="arrange.distributeH" />
        <Item id="arrange.distributeV" />
        <Sep />
        <Item id="arrange.flipH" />
        <Item id="arrange.flipV" />
        <Item id="arrange.rotateLeft" />
        <Item id="arrange.rotateRight" />
      </Top>
      <Top label={t('menu.document')}>
        <Item id="document.addArtboard" />
        <Sub label={t('studio.formats')}>
          {FORMAT_PRESETS.map((f) => (
            <Menu.Item key={f.id} className="menu-item" onSelect={() => addArtboard(f.width, f.height)}>
              <span className="menu-check" />
              <span className="menu-label">{t(`format.${f.id}`)}</span>
              <span className="menu-shortcut">
                {f.width} × {f.height}
              </span>
            </Menu.Item>
          ))}
        </Sub>
        <Item id="document.deleteArtboard" />
      </Top>
      <Top label={t('menu.view')}>
        <Item id="view.zoomIn" />
        <Item id="view.zoomOut" />
        <Item id="view.zoomFit" />
        <Item id="view.zoom100" />
        <Sep />
        <Item id="view.rulers" checked={settings.rulers} />
        <Item id="view.grid" checked={settings.grid} />
        <Item id="view.snapping" checked={settings.snapping} />
        <Sep />
        <Sub label={t('view.theme')}>
          {(['dark', 'light'] as const).map((th) => (
            <Menu.Item key={th} className="menu-item" onSelect={() => setSettings({ theme: th })}>
              <span className="menu-check">{settings.theme === th ? '✓' : ''}</span>
              <span className="menu-label">{t(th === 'dark' ? 'view.themeDark' : 'view.themeLight')}</span>
            </Menu.Item>
          ))}
        </Sub>
        <Sub label={t('view.toolsSide')}>
          {(['left', 'right'] as const).map((side) => (
            <Menu.Item key={side} className="menu-item" onSelect={() => setSettings({ toolsSide: side })}>
              <span className="menu-check">{settings.toolsSide === side ? '✓' : ''}</span>
              <span className="menu-label">{t(side === 'left' ? 'view.left' : 'view.right')}</span>
            </Menu.Item>
          ))}
        </Sub>
        <Sub label={t('view.studioSide')}>
          {(['left', 'right'] as const).map((side) => (
            <Menu.Item key={side} className="menu-item" onSelect={() => setSettings({ studioSide: side })}>
              <span className="menu-check">{settings.studioSide === side ? '✓' : ''}</span>
              <span className="menu-label">{t(side === 'left' ? 'view.left' : 'view.right')}</span>
            </Menu.Item>
          ))}
        </Sub>
        <Sub label={t('view.language')}>
          {(['fr', 'en'] as const).map((l) => (
            <Menu.Item key={l} className="menu-item" onSelect={() => setLang(l)}>
              <span className="menu-check">{getLang() === l ? '✓' : ''}</span>
              <span className="menu-label">{l === 'fr' ? 'Français' : 'English'}</span>
            </Menu.Item>
          ))}
        </Sub>
      </Top>
      <Top label={t('menu.help')}>
        <Item id="help.shortcuts" />
        <Item id="help.about" />
      </Top>
    </nav>
  );
}
