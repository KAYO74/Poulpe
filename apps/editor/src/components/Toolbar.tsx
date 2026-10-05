import { COMMANDS, formatShortcut, type CommandId } from '../commands';
import { getLang, setLang, useT } from '../i18n';
import { setSettings, ui, useEditor, useUi } from '../store';
import { Icon, type IconName } from './Icon';

function CmdButton({ id, icon }: { id: CommandId; icon: IconName }) {
  const t = useT();
  useEditor();
  const cmd = COMMANDS[id] as (typeof COMMANDS)[CommandId] & { enabled?: () => boolean; shortcut?: string };
  const label = t(cmd.label) + (cmd.shortcut ? ` (${formatShortcut(cmd.shortcut)})` : '');
  return (
    <button
      className="ib"
      title={label}
      aria-label={label}
      disabled={cmd.enabled ? !cmd.enabled() : false}
      onClick={() => cmd.run()}
    >
      <Icon name={icon} />
    </button>
  );
}

function Toggle({
  on,
  icon,
  label,
  onClick,
}: {
  on: boolean;
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="ib" aria-pressed={on} title={label} aria-label={label} onClick={onClick}>
      <Icon name={icon} />
    </button>
  );
}

export function Toolbar() {
  const t = useT();
  const settings = useUi((s) => s.settings);
  return (
    <div className="toolbar" role="toolbar" aria-label="Barre d'outils">
      <div className="personas" role="group" aria-label="Personas">
        <button
          className="persona"
          aria-pressed="true"
          title={t('persona.draw')}
          aria-label={t('persona.draw')}
        >
          <Icon name="draw" />
        </button>
        <button className="persona" disabled title={t('persona.photo')} aria-label={t('persona.photo')}>
          <Icon name="photo" />
        </button>
        <button className="persona" disabled title={t('persona.layout')} aria-label={t('persona.layout')}>
          <Icon name="layout" />
        </button>
      </div>
      <Toggle
        on={settings.library}
        icon="library"
        label={t('view.library')}
        onClick={() => setSettings({ library: !settings.library })}
      />
      <span className="tsep" />
      <Toggle
        on={settings.snapping}
        icon="snap"
        label={t('view.snapping')}
        onClick={() => setSettings({ snapping: !settings.snapping })}
      />
      <Toggle
        on={settings.grid}
        icon="grid"
        label={t('view.grid')}
        onClick={() => setSettings({ grid: !settings.grid })}
      />
      <Toggle
        on={settings.rulers}
        icon="ruler"
        label={t('view.rulers')}
        onClick={() => setSettings({ rulers: !settings.rulers })}
      />
      <span className="tsep" />
      <CmdButton id="arrange.front" icon="front" />
      <CmdButton id="arrange.forward" icon="forward" />
      <CmdButton id="arrange.backward" icon="backward" />
      <CmdButton id="arrange.back" icon="back" />
      <span className="tsep" />
      <CmdButton id="layer.group" icon="group" />
      <CmdButton id="layer.ungroup" icon="ungroup" />
      <CmdButton id="layer.clip" icon="mask" />
      <span className="tsep" />
      <CmdButton id="geometry.unite" icon="unite" />
      <CmdButton id="geometry.subtract" icon="subtract" />
      <CmdButton id="geometry.intersect" icon="intersect" />
      <CmdButton id="geometry.exclude" icon="exclude" />
      <CmdButton id="geometry.divide" icon="divide" />
      <span className="tsep" />
      <CmdButton id="arrange.alignLeft" icon="alignLeft" />
      <CmdButton id="arrange.alignHCenter" icon="alignHCenter" />
      <CmdButton id="arrange.alignRight" icon="alignRight" />
      <CmdButton id="arrange.alignTop" icon="alignTop" />
      <CmdButton id="arrange.alignVCenter" icon="alignVCenter" />
      <CmdButton id="arrange.alignBottom" icon="alignBottom" />
      <CmdButton id="arrange.distributeH" icon="distributeH" />
      <CmdButton id="arrange.distributeV" icon="distributeV" />
      <span className="tsep" />
      <CmdButton id="arrange.flipH" icon="flipH" />
      <CmdButton id="arrange.flipV" icon="flipV" />
      <CmdButton id="arrange.rotateLeft" icon="rotateLeft" />
      <CmdButton id="arrange.rotateRight" icon="rotateRight" />
      <span className="spacer" />
      <CmdButton id="edit.undo" icon="undo" />
      <CmdButton id="edit.redo" icon="redo" />
      <span className="tsep" />
      <button
        className="ib lang"
        title={t('view.language')}
        aria-label={t('view.language')}
        onClick={() => setLang(getLang() === 'fr' ? 'en' : 'fr')}
      >
        {getLang() === 'fr' ? 'FR' : 'EN'}
      </button>
      <button
        className="ib"
        title={t('view.theme')}
        aria-label={t('view.theme')}
        onClick={() => setSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
      >
        <Icon name={settings.theme === 'dark' ? 'moon' : 'sun'} />
      </button>
      <button
        className="ib"
        title={t('view.toolsSide')}
        aria-label={t('view.toolsSide')}
        onClick={() => setSettings({ toolsSide: settings.toolsSide === 'right' ? 'left' : 'right' })}
      >
        <Icon name={settings.toolsSide === 'right' ? 'sideRight' : 'sideLeft'} />
      </button>
      <button className="btn primary" onClick={() => ui.set({ dialog: 'export' })}>
        <Icon name="export" />
        {t('file.export')}
      </button>
    </div>
  );
}
