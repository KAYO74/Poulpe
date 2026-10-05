import { useEffect, useRef, useState } from 'react';
import {
  BLEND_MODES,
  findNode,
  moveNodeTo,
  type Artboard,
  type BlendMode,
  type SceneNode,
} from '@poulpe/core';
import { deleteSelection, updateSelected } from '../actions';
import { AdjustmentMenu } from '../components/AdjustmentMenu';
import { COMMANDS, runCommand } from '../commands';
import { toggleMaskEdit } from '../photo/photoActions';
import { images } from '../photo/pixels';
import { NumberField, Select } from '../components/fields';
import { Icon, type IconName } from '../components/Icon';
import { useT } from '../i18n';
import { editor, ui, useEditor, useUi } from '../store';

const TYPE_ICON: Record<SceneNode['type'], IconName> = {
  rect: 'rect',
  ellipse: 'ellipse',
  polygon: 'polygon',
  star: 'star',
  line: 'line',
  path: 'path',
  text: 'text',
  image: 'image',
  group: 'folder',
  adjustment: 'adjust',
};

/** Vignette d'un masque de calque : blanc = visible, noir = caché. */
function MaskThumb({ node, active, onClick }: { node: SceneNode; active: boolean; onClick: () => void }) {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);
  const { doc } = useEditor();
  const mask = node.mask!;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const draw = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      const img = images().get(doc, mask.assetId);
      if (!img) return false;
      const tmp = document.createElement('canvas');
      tmp.width = c.width;
      tmp.height = c.height;
      const tc = tmp.getContext('2d')!;
      tc.drawImage(img, 0, 0, c.width, c.height);
      tc.globalCompositeOperation = 'source-in';
      tc.fillStyle = '#fff';
      tc.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(tmp, 0, 0);
      return true;
    };
    if (!draw()) {
      const id = setTimeout(draw, 300);
      return () => clearTimeout(id);
    }
  }, [doc, mask.assetId]);
  return (
    <button
      className={`mask-thumb${active ? ' on' : ''}${mask.enabled ? '' : ' off'}`}
      title={t('layers.mask')}
      aria-label={t('layers.mask')}
      aria-pressed={active}
      data-testid={`mask-${node.id}`}
      onClick={(e) => {
        e.stopPropagation();
        editor.select([node.id]);
        toggleMaskEdit(node.id);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <canvas ref={ref} width={20} height={14} onClick={onClick} />
    </button>
  );
}

type Drop = { parentId: string; index: number } | null;

export function LayersPanel() {
  const t = useT();
  const { doc, selection } = useEditor();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const maskEditId = useUi((s) => s.maskEditId);
  const persona = useUi((s) => s.persona);
  const first = selection.length ? findNode(doc, selection[0])?.node : null;

  const toggleCollapse = (id: string) =>
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const setProp = (id: string, label: string, fn: (n: SceneNode) => void) =>
    editor.apply(label, (d) => {
      const n = findNode(d, id)?.node;
      if (n) fn(n);
    });

  const onSelect = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      editor.select(selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id]);
    } else editor.select([id]);
  };

  const finishDrop = () => {
    if (drag && drop)
      editor.apply('history.order', (d) => void moveNodeTo(d, drag, drop.parentId, drop.index));
    setDrag(null);
    setDrop(null);
  };

  /** Les calques s'affichent du dessus vers le dessous, comme dans Affinity. */
  const renderNodes = (nodes: SceneNode[], parentId: string, depth: number): React.ReactNode =>
    [...nodes]
      .map((n, i) => ({ n, i }))
      .reverse()
      .map(({ n, i }) => {
        const isGroup = n.type === 'group';
        const open = isGroup && !collapsed.has(n.id);
        const sel = selection.includes(n.id);
        return (
          <li key={n.id} role="treeitem" aria-selected={sel} aria-expanded={isGroup ? open : undefined}>
            <div
              className={`layer${sel ? ' sel' : ''}${!n.visible ? ' hidden' : ''}${drop?.parentId === parentId && drop.index === i + 1 ? ' drop-above' : ''}${drop?.parentId === parentId && drop.index === i ? ' drop-below' : ''}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              draggable
              onDragStart={(e) => {
                setDrag(n.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                if (!drag || drag === n.id) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const y = (e.clientY - r.top) / r.height;
                if (isGroup && y > 0.3 && y < 0.7)
                  setDrop({ parentId: n.id, index: (n as { children: SceneNode[] }).children.length });
                else setDrop({ parentId, index: y < 0.5 ? i + 1 : i });
              }}
              onDrop={(e) => {
                e.preventDefault();
                finishDrop();
              }}
              onDragEnd={() => {
                setDrag(null);
                setDrop(null);
              }}
              onClick={(e) => onSelect(n.id, e)}
              onDoubleClick={() => setRenaming(n.id)}
            >
              {isGroup ? (
                <button
                  className="twisty"
                  aria-label={open ? '−' : '+'}
                  onClick={(e) => (e.stopPropagation(), toggleCollapse(n.id))}
                >
                  <Icon name={open ? 'chevronDown' : 'chevron'} size={12} />
                </button>
              ) : (
                <span className="twisty" />
              )}
              <span className="layer-icon">
                <Icon name={n.type === 'group' && n.clip ? 'mask' : TYPE_ICON[n.type]} size={14} />
              </span>
              {n.mask && <MaskThumb node={n} active={maskEditId === n.id} onClick={() => {}} />}
              {renaming === n.id ? (
                <input
                  className="rename"
                  autoFocus
                  defaultValue={n.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== n.name) setProp(n.id, 'history.rename', (m) => void (m.name = v));
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setRenaming(null);
                  }}
                />
              ) : (
                <span className="layer-name">{n.name}</span>
              )}
              <button
                className={`layer-btn${n.locked ? ' on' : ''}`}
                aria-pressed={n.locked}
                title={n.locked ? t('layer.unlock') : t('layer.lock')}
                aria-label={n.locked ? t('layer.unlock') : t('layer.lock')}
                onClick={(e) => {
                  e.stopPropagation();
                  setProp(n.id, 'history.lock', (m) => void (m.locked = !m.locked));
                }}
              >
                <Icon name={n.locked ? 'lock' : 'unlock'} size={14} />
              </button>
              <button
                className={`layer-btn${!n.visible ? ' on' : ''}`}
                aria-pressed={!n.visible}
                title={n.visible ? t('layer.hide') : t('layer.show')}
                aria-label={n.visible ? t('layer.hide') : t('layer.show')}
                onClick={(e) => {
                  e.stopPropagation();
                  setProp(n.id, 'history.visibility', (m) => void (m.visible = !m.visible));
                }}
              >
                <Icon name={n.visible ? 'eye' : 'eyeOff'} size={14} />
              </button>
            </div>
            {open && <ul role="group">{renderNodes(n.children, n.id, depth + 1)}</ul>}
          </li>
        );
      });

  const artboard = (ab: Artboard) => (
    <li key={ab.id} role="treeitem" aria-expanded>
      <div
        className={`layer artboard${ab.id === editor.getState().activeArtboardId ? ' active' : ''}${drop?.parentId === ab.id && drop.index === ab.children.length ? ' drop-below' : ''}`}
        onClick={() => {
          editor.setActiveArtboard(ab.id);
          editor.select([]);
        }}
        onDragOver={(e) => {
          if (!drag) return;
          e.preventDefault();
          setDrop({ parentId: ab.id, index: ab.children.length });
        }}
        onDrop={(e) => {
          e.preventDefault();
          finishDrop();
        }}
      >
        <span className="layer-icon">
          <Icon name="artboard" size={14} />
        </span>
        <span className="layer-name">{ab.name}</span>
        <span className="layer-meta num">
          {ab.width} × {ab.height}
        </span>
      </div>
      {ab.children.length ? (
        <ul role="group">{renderNodes(ab.children, ab.id, 1)}</ul>
      ) : (
        <p className="empty indent">{t('layers.empty')}</p>
      )}
    </li>
  );

  return (
    <div className="panel-body layers-panel">
      <div className="picker-row">
        <NumberField
          label={t('layers.opacity')}
          value={first ? Math.round(first.opacity * 100) : null}
          disabled={!first}
          min={0}
          max={100}
          unit="%"
          width={96}
          testId="layer-opacity"
          onChange={(v) => updateSelected('history.style', (n) => void (n.opacity = v / 100))}
        />
        <Select<BlendMode>
          label={t('layers.blend')}
          value={first?.blendMode ?? 'normal'}
          options={BLEND_MODES.map((m) => ({ value: m, label: t(`blend.${m}`) }))}
          onChange={(m) => updateSelected('history.style', (n) => void (n.blendMode = m))}
        />
      </div>
      <ul className="layer-tree" role="tree" aria-label={t('studio.layers')}>
        {[...doc.artboards].reverse().map(artboard)}
      </ul>
      {persona === 'photo' && (
        <div className="layer-actions">
          <button
            className="ib small"
            title={t('layer.newPixel')}
            aria-label={t('layer.newPixel')}
            onClick={() => runCommand('layer.newPixel')}
          >
            <Icon name="pixelLayer" size={14} />
          </button>
          <button
            className="ib small"
            title={t('layer.addMask')}
            aria-label={t('layer.addMask')}
            disabled={!COMMANDS['layer.addMask'].enabled()}
            onClick={() => runCommand('layer.addMask')}
          >
            <Icon name="addMask" size={14} />
          </button>
          <AdjustmentMenu small />
          <span className="spacer" />
          <button
            className="ib small"
            title={t('edit.delete')}
            aria-label={t('edit.delete')}
            disabled={!selection.length}
            onClick={() => {
              if (ui.get().maskEditId && selection.includes(ui.get().maskEditId!))
                ui.set({ maskEditId: null });
              deleteSelection();
            }}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
