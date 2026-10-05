import { findArtboard } from '@poulpe/core';
import { boundsOf } from '../actions';
import { useT } from '../i18n';
import { useEditor, useUi } from '../store';

const HINTS: Record<string, string> = {
  select: 'hint.select',
  direct: 'hint.direct',
  artboard: 'hint.artboard',
  rect: 'hint.shape',
  ellipse: 'hint.shape',
  polygon: 'hint.shape',
  star: 'hint.shape',
  line: 'hint.line',
  text: 'hint.text',
  image: 'hint.image',
  hand: 'hint.hand',
  zoom: 'hint.zoom',
  eyedropper: 'hint.eyedropper',
};

export function StatusBar() {
  const t = useT();
  const tool = useUi((s) => s.tool);
  const zoom = useUi((s) => s.view.zoom);
  const cursor = useUi((s) => s.cursor);
  const toastMsg = useUi((s) => s.toast);
  const cropping = useUi((s) => s.cropId !== null);
  const { doc, selection, activeArtboardId } = useEditor();
  const ab = findArtboard(doc, activeArtboardId);
  const b = selection.length ? boundsOf(doc, selection) : null;
  return (
    <footer className="statusbar">
      <span className="hint">
        <b>{cropping ? t('ctx.crop') : t(`tool.${tool}`)}</b> : {t(cropping ? 'hint.crop' : HINTS[tool])}
      </span>
      <span className="spacer" />
      {toastMsg && (
        <span className="toast" role="status">
          {toastMsg}
        </span>
      )}
      <span className="num">
        {b ? `${Math.round(b.width)} × ${Math.round(b.height)} px` : t('status.nothing')}
      </span>
      <span className="num">{cursor ? `x ${cursor.x} · y ${cursor.y}` : 'x – · y –'}</span>
      {ab && <span className="num">{`${ab.width} × ${ab.height} px`}</span>}
      <span className="num" data-testid="zoom">
        {Math.round(zoom * 100)} %
      </span>
    </footer>
  );
}
