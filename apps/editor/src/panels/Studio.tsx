import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useT, type MessageKey } from '../i18n';
import { useUi } from '../store';
import { CharacterPanel } from './CharacterPanel';
import { ColorPanel } from './ColorPanel';
import { HistoryPanel } from './HistoryPanel';
import { LayersPanel } from './LayersPanel';
import { StrokePanel } from './StrokePanel';
import { TransformPanel } from './TransformPanel';

interface Tab {
  id: string;
  label: MessageKey;
  render: () => React.ReactNode;
}

/** Groupe d'onglets repliable, comme les Studios d'Affinity. */
function StudioGroup({ tabs, grow, initial = 0 }: { tabs: Tab[]; grow?: boolean; initial?: number }) {
  const t = useT();
  const [active, setActive] = useState(initial);
  const [open, setOpen] = useState(true);
  return (
    <section className={`studio-group${grow && open ? ' grow' : ''}`}>
      <header className="studio-tabs" role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={i === active}
            className="studio-tab"
            data-testid={`tab-${tab.id}`}
            onClick={() => {
              setActive(i);
              setOpen(true);
            }}
          >
            {t(tab.label)}
          </button>
        ))}
        <span className="spacer" />
        <button
          className="ib small"
          aria-expanded={open}
          aria-label={open ? '−' : '+'}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'chevronDown' : 'chevron'} size={12} />
        </button>
      </header>
      {open && (
        <div className="studio-content" role="tabpanel">
          {tabs[active].render()}
        </div>
      )}
    </section>
  );
}

export function Studio() {
  const editingText = useUi((s) => s.tool === 'text');
  return (
    <aside className="studio" aria-label="Studio">
      <StudioGroup
        key={editingText ? 'text' : 'color'}
        initial={editingText ? 3 : 0}
        tabs={[
          { id: 'color', label: 'studio.color', render: () => <ColorPanel /> },
          { id: 'stroke', label: 'studio.stroke', render: () => <StrokePanel /> },
          { id: 'transform', label: 'studio.transform', render: () => <TransformPanel /> },
          { id: 'character', label: 'studio.character', render: () => <CharacterPanel /> },
        ]}
      />
      <StudioGroup
        grow
        tabs={[
          { id: 'layers', label: 'studio.layers', render: () => <LayersPanel /> },
          { id: 'history', label: 'studio.history', render: () => <HistoryPanel /> },
        ]}
      />
    </aside>
  );
}
