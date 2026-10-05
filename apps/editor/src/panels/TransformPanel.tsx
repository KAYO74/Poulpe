import { useState } from 'react';
import {
  boxCenter,
  findNode,
  localToWorld,
  nodeBounds,
  rotateNode,
  rotatePoint,
  scaleNode,
  selectionBounds,
  topLevelIds,
  translateNode,
} from '@poulpe/core';
import { NumberField } from '../components/fields';
import { Icon } from '../components/Icon';
import { useT } from '../i18n';
import { editor, useEditor } from '../store';

/** Position, taille et rotation de la sélection (boîte englobante pour plusieurs objets). */
export function TransformPanel() {
  const t = useT();
  const { doc, selection } = useEditor();
  const [lockRatio, setLockRatio] = useState(false);
  const single = selection.length === 1 ? findNode(doc, selection[0])?.node : null;
  const box = single && single.type !== 'group' ? single : selectionBounds(doc, selection);
  if (!box)
    return (
      <div className="panel-body">
        <p className="empty">{t('transform.nothing')}</p>
      </div>
    );
  const rotation = single && single.type !== 'group' ? single.rotation : 0;

  const apply = (
    label: string,
    fn: (ids: string[], d: Parameters<Parameters<typeof editor.apply>[1]>[0]) => void,
  ) => editor.apply(label, (d) => fn(topLevelIds(d, selection), d));

  const setPos = (axis: 'x' | 'y', v: number) =>
    apply('history.move', (ids, d) => {
      const delta = v - box[axis];
      for (const id of ids)
        translateNode(findNode(d, id)!.node, axis === 'x' ? delta : 0, axis === 'y' ? delta : 0);
    });

  const setSize = (axis: 'width' | 'height', v: number) =>
    apply('history.resize', (ids, d) => {
      const k = v / (box[axis] || 1);
      if (single && single.type !== 'group') {
        const n = findNode(d, single.id)!.node;
        const corner = localToWorld(n, { x: 0, y: 0 });
        const other = axis === 'width' ? 'height' : 'width';
        n[axis] = Math.max(1, v);
        if (lockRatio) n[other] = Math.max(1, n[other] * k);
        // Le coin haut gauche reste en place, dans le repère de l'objet.
        const c = rotatePoint({ x: corner.x + n.width / 2, y: corner.y + n.height / 2 }, corner, n.rotation);
        n.x = c.x - n.width / 2;
        n.y = c.y - n.height / 2;
        if (n.type === 'text' && axis === 'width') n.autoWidth = false;
        return;
      }
      const sx = axis === 'width' || lockRatio ? k : 1;
      const sy = axis === 'height' || lockRatio ? k : 1;
      for (const id of ids) scaleNode(findNode(d, id)!.node, sx, sy, { x: box.x, y: box.y });
    });

  const setRotation = (v: number) =>
    apply('history.rotate', (ids, d) => {
      const c = boxCenter(selectionBounds(d, ids)!);
      for (const id of ids) {
        const n = findNode(d, id)!.node;
        rotateNode(
          n,
          v - (n.type === 'group' ? 0 : n.rotation),
          n.type === 'group' ? c : boxCenter(nodeBounds(n)),
        );
      }
    });

  return (
    <div className="panel-body transform">
      <div className="grid2">
        <NumberField
          label={t('transform.x')}
          value={box.x}
          decimals={1}
          unit="px"
          onChange={(v) => setPos('x', v)}
          testId="tf-x"
        />
        <NumberField
          label={t('transform.y')}
          value={box.y}
          decimals={1}
          unit="px"
          onChange={(v) => setPos('y', v)}
          testId="tf-y"
        />
        <NumberField
          label={t('transform.w')}
          value={box.width}
          min={1}
          decimals={1}
          unit="px"
          onChange={(v) => setSize('width', v)}
          testId="tf-w"
        />
        <NumberField
          label={t('transform.h')}
          value={box.height}
          min={1}
          decimals={1}
          unit="px"
          onChange={(v) => setSize('height', v)}
          testId="tf-h"
        />
        <NumberField
          label={t('transform.rotation')}
          value={rotation}
          decimals={1}
          unit="°"
          onChange={setRotation}
          testId="tf-r"
        />
        <button
          className="ib"
          aria-pressed={lockRatio}
          title={t('transform.lockRatio')}
          aria-label={t('transform.lockRatio')}
          onClick={() => setLockRatio(!lockRatio)}
        >
          <Icon name="link" />
        </button>
      </div>
    </div>
  );
}
