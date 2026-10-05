import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { useT, type MessageKey } from '../i18n';
import { useEditor, useUi, type Persona } from '../store';
import { useActiveWorkspace } from '../workspaces';
import { FloatingFrame } from './FloatingFrame';
import {
  DEFAULT_PANELS,
  PANEL_LIMITS,
  dockPanel,
  floatPanel,
  panels,
  startPanelDrag,
  startSplitter,
  usePanels,
  type PanelId,
} from './panelLayout';
import { findNode } from '@poulpe/core';
import { AdjustmentPanel } from './AdjustmentPanel';
import { BrushPanel } from './BrushPanel';
import { HistogramPanel } from './HistogramPanel';
import { CharacterPanel } from './CharacterPanel';
import { ColorPanel } from './ColorPanel';
import { EffectsPanel } from './EffectsPanel';
import { HistoryPanel } from './HistoryPanel';
import { LayersPanel } from './LayersPanel';
import { StrokePanel } from './StrokePanel';
import { TransformPanel } from './TransformPanel';
import { MacrosPanel } from '../macros/MacrosPanel';

interface Tab {
  id: string;
  label: MessageKey;
  render: () => React.ReactNode;
}

/** Onglet actif et état replié de chaque groupe, conservés quand il passe d'ancré à flottant. */
const groupState = new Map<string, { active: number; open: boolean }>();

/**
 * Groupe d'onglets repliable, comme les Studios d'Affinity. Sa barre d'onglets sert de poignée :
 * on la glisse pour détacher le groupe en fenêtre flottante (comme dans Photoshop), on la ramène
 * sur le Studio pour le ré-ancrer. Double-clic sur la barre : détacher / ré-ancrer.
 */
function StudioGroup({
  id,
  stateKey,
  tabs,
  initial = 0,
  floating,
  style,
}: {
  id: PanelId;
  stateKey: string;
  tabs: Tab[];
  initial?: number;
  floating?: boolean;
  style?: React.CSSProperties;
}) {
  const t = useT();
  const side = useUi((s) => s.settings.studioSide);
  const saved = groupState.get(stateKey);
  const [active, setActiveState] = useState(saved?.active ?? initial);
  const [open, setOpenState] = useState(saved?.open ?? true);
  const ref = useRef<HTMLElement>(null);
  const remember = (a: number, o: boolean) => groupState.set(stateKey, { active: a, open: o });
  const setActive = (i: number) => {
    setActiveState(i);
    setOpenState(true);
    remember(i, true);
  };
  const setOpen = (o: boolean) => {
    setOpenState(o);
    remember(active, o);
  };
  const current = Math.min(active, tabs.length - 1);
  const toggleFloat = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[role="tab"],[data-no-drag]')) return;
    if (floating) return dockPanel(id);
    const r = ref.current!.getBoundingClientRect();
    const x = side === 'left' ? r.right + 24 : r.left - r.width - 24;
    floatPanel(id, { x, y: r.top + 20, w: r.width, h: Math.max(r.height, 240) });
  };
  const section = (
    <section
      ref={ref}
      className={`studio-group${open ? ' open' : ''}`}
      data-testid={`studio-${id}`}
      style={style}
    >
      <header
        className="studio-tabs panel-handle"
        role="tablist"
        title={t(floating ? 'panel.dockHint' : 'panel.floatHint')}
        onPointerDown={(e) => startPanelDrag(e, id, ref.current)}
        onDoubleClick={toggleFloat}
      >
        <span className="panel-grip" aria-hidden="true" />
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={i === current}
            className="studio-tab"
            data-testid={`tab-${tab.id}`}
            onClick={() => setActive(i)}
          >
            {t(tab.label)}
          </button>
        ))}
        <span className="spacer" />
        {floating && (
          <button
            className="ib small"
            data-no-drag
            title={t('panel.dock')}
            aria-label={t('panel.dock')}
            data-testid={`dock-${id}`}
            onClick={() => dockPanel(id)}
          >
            <Icon name={side === 'left' ? 'sideLeft' : 'sideRight'} size={12} />
          </button>
        )}
        <button
          className="ib small"
          data-no-drag
          aria-expanded={open}
          aria-label={open ? '−' : '+'}
          onClick={() => setOpen(!open)}
        >
          <Icon name={open ? 'chevronDown' : 'chevron'} size={12} />
        </button>
      </header>
      {open && (
        <div className="studio-content" role="tabpanel">
          {tabs[current].render()}
        </div>
      )}
    </section>
  );
  if (!floating) return section;
  return (
    <FloatingFrame id={id} label={t(tabs[current].label)} className={open ? '' : 'collapsed'}>
      {section}
    </FloatingFrame>
  );
}

interface GroupDef {
  id: PanelId;
  stateKey: string;
  tabs: Tab[];
  initial?: number;
}

const TABS: Record<string, Tab> = {
  color: { id: 'color', label: 'studio.color', render: () => <ColorPanel /> },
  stroke: { id: 'stroke', label: 'studio.stroke', render: () => <StrokePanel /> },
  effects: { id: 'effects', label: 'studio.effects', render: () => <EffectsPanel /> },
  transform: { id: 'transform', label: 'studio.transform', render: () => <TransformPanel /> },
  character: { id: 'character', label: 'studio.character', render: () => <CharacterPanel /> },
  brush: { id: 'brush', label: 'studio.brush', render: () => <BrushPanel /> },
  adjustment: { id: 'adjustment', label: 'studio.adjustment', render: () => <AdjustmentPanel /> },
  histogram: { id: 'histogram', label: 'studio.histogram', render: () => <HistogramPanel /> },
  layers: { id: 'layers', label: 'studio.layers', render: () => <LayersPanel /> },
  history: { id: 'history', label: 'studio.history', render: () => <HistoryPanel /> },
  macros: { id: 'macros', label: 'macro.title', render: () => <MacrosPanel /> },
};

const TOP_DRAW = ['color', 'stroke', 'effects', 'transform', 'character'];
const TOP_PHOTO = ['color', 'brush', 'adjustment', 'histogram', 'effects'];
const BOTTOM = ['layers', 'history'];
const BOTTOM_DRAW = [...BOTTOM, 'macros'];

/** Onglets du Studio d'une Persona, dans l'ordre (pour la boîte « Espace de travail »). */
export function studioTabsFor(persona: Persona): { id: string; label: MessageKey }[] {
  return [...(persona === 'photo' ? [...TOP_PHOTO, ...BOTTOM] : [...TOP_DRAW, ...BOTTOM_DRAW])].map(
    (id) => TABS[id],
  );
}

function useGroups(): GroupDef[] {
  const editingText = useUi((s) => s.tool === 'text');
  const persona = useUi((s) => s.persona);
  const allowed = useActiveWorkspace()?.tabs ?? null;
  const { doc, selection } = useEditor();
  const adjusting = selection.length === 1 && findNode(doc, selection[0])?.node.type === 'adjustment';
  const pick = (ids: string[]) => ids.filter((id) => !allowed || allowed.includes(id)).map((id) => TABS[id]);
  const photo = persona === 'photo';
  const focus = photo ? (adjusting ? 'adjustment' : null) : editingText ? 'character' : null;
  const top = pick(photo ? TOP_PHOTO : TOP_DRAW);
  const groups: GroupDef[] = [
    {
      id: 'studio-top',
      stateKey: `${photo ? 'photo' : 'draw'}${focus ? `-${focus}` : ''}`,
      initial: Math.max(
        0,
        top.findIndex((tab) => tab.id === focus),
      ),
      tabs: top,
    },
    {
      id: 'studio-bottom',
      stateKey: photo ? 'layers' : 'layers-draw',
      tabs: pick(photo ? BOTTOM : BOTTOM_DRAW),
    },
  ];
  return groups.filter((g) => g.tabs.length > 0);
}

export function Studio() {
  const t = useT();
  const groups = useGroups();
  const side = useUi((s) => s.settings.studioSide);
  const dropping = useUi((s) => s.panelDock !== null && s.panelDock !== 'tools');
  const floating = usePanels((s) => s.floating);
  const width = usePanels((s) => s.studioW);
  const topH = usePanels((s) => s.topH);
  const asideRef = useRef<HTMLElement>(null);
  const docked = groups.filter((g) => !floating[g.id]);
  const loose = groups.filter((g) => floating[g.id]);
  const both = docked.length === 2;
  return (
    <>
      {docked.length > 0 && (
        <aside
          ref={asideRef}
          className={`studio${dropping ? ' drop-target' : ''}`}
          aria-label="Studio"
          data-testid="studio"
          style={{ width }}
        >
          {docked.map((g, i) => [
            i === 1 && (
              <div
                key="split"
                className="split-v"
                role="separator"
                aria-orientation="horizontal"
                aria-label={t('panel.resize')}
                data-testid="studio-split"
                onPointerDown={(e) => {
                  const top = asideRef
                    .current!.querySelector('.studio-group')!
                    .getBoundingClientRect().height;
                  const total = asideRef.current!.getBoundingClientRect().height;
                  startSplitter(
                    e,
                    'topH',
                    1,
                    [PANEL_LIMITS.minH, Math.max(PANEL_LIMITS.minH, total - 120)],
                    top,
                  );
                }}
                onDoubleClick={() => panels.set({ topH: null })}
              />
            ),
            <StudioGroup
              key={g.stateKey}
              {...g}
              style={
                i === 0 && both && topH !== null
                  ? { flex: `0 0 ${topH}px` }
                  : i === docked.length - 1
                    ? { flex: '1 1 0' }
                    : undefined
              }
            />,
          ])}
          <div
            className={`split-h ${side === 'right' ? 'at-left' : 'at-right'}`}
            role="separator"
            aria-orientation="vertical"
            aria-label={t('panel.resize')}
            data-testid="studio-resize"
            onPointerDown={(e) =>
              startSplitter(e, 'studioW', side === 'right' ? -1 : 1, [...PANEL_LIMITS.studioW], width)
            }
            onDoubleClick={() => panels.set({ studioW: DEFAULT_PANELS.studioW })}
          />
        </aside>
      )}
      {docked.length === 0 && dropping && <div className={`dock-band ${side}`} aria-hidden="true" />}
      {loose.map((g) => (
        <StudioGroup key={g.stateKey} {...g} floating />
      ))}
    </>
  );
}
