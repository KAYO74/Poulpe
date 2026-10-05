import * as Menu from '@radix-ui/react-dropdown-menu';
import { useT } from '../i18n';
import { ui } from '../store';
import { applyWorkspace, useActiveWorkspace, useWorkspaces } from '../workspaces';
import { Icon } from './Icon';

/** Choix d'un espace de travail personnalisé, à côté des trois Personas intégrées. */
export function WorkspaceMenu() {
  const t = useT();
  const list = useWorkspaces((s) => s.list);
  const active = useActiveWorkspace();
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        className={`persona workspace-trigger${active ? ' named' : ''}`}
        aria-pressed={!!active}
        title={t('workspace.menu')}
        aria-label={t('workspace.menu')}
        data-testid="workspace-menu"
      >
        {active ? <span className="workspace-name">{active.name}</span> : <Icon name="columns" />}
        <Icon name="chevronDown" size={10} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content className="menu" align="start" sideOffset={4}>
          <WorkspaceItems />
          {list.length === 0 && (
            <div className="menu-note" role="note">
              {t('workspace.empty')}
            </div>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** Éléments du menu des espaces (barre d'outils et menu Affichage). */
export function WorkspaceItems() {
  const t = useT();
  const list = useWorkspaces((s) => s.list);
  const active = useActiveWorkspace();
  return (
    <>
      {list.map((w) => (
        <Menu.Item
          key={w.id}
          className="menu-item"
          data-testid={`workspace-${w.name}`}
          onSelect={() => applyWorkspace(w.id)}
        >
          <span className="menu-check">{active?.id === w.id ? '✓' : ''}</span>
          <span className="menu-label">{w.name}</span>
          <span className="menu-shortcut">{t(`workspace.base.${w.base}`)}</span>
        </Menu.Item>
      ))}
      {list.length > 0 && <Menu.Separator className="menu-sep" />}
      <Menu.Item
        className="menu-item"
        data-testid="workspace-new"
        onSelect={() => ui.set({ dialog: 'workspace', workspaceEdit: null })}
      >
        <span className="menu-check" />
        <span className="menu-label">{t('workspace.new')}</span>
      </Menu.Item>
      {active && (
        <Menu.Item
          className="menu-item"
          data-testid="workspace-edit"
          onSelect={() => ui.set({ dialog: 'workspace', workspaceEdit: active.id })}
        >
          <span className="menu-check" />
          <span className="menu-label">{t('workspace.edit', { name: active.name })}</span>
        </Menu.Item>
      )}
    </>
  );
}
