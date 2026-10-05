import { useState } from 'react';
import { Icon } from '../components/Icon';
import { useT } from '../i18n';
import {
  beginRecording,
  cancelRecording,
  deleteMacro,
  endRecording,
  exportMacro,
  importMacro,
  playMacro,
  removeStep,
  renameMacro,
  stepLabel,
  useMacros,
} from './macros';

/** Onglet Macros du Studio : enregistrer, rejouer, renommer, partager. */
export function MacrosPanel() {
  const t = useT();
  const { macros, recording, recorded } = useMacros();
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="panel-body macros">
      <div className="macro-bar">
        {recording ? (
          <>
            <span className="rec-dot" aria-hidden="true" />
            <span className="macro-rec" data-testid="macro-recording">
              {t('macro.recording', { n: recorded })}
            </span>
            <button className="btn" onClick={cancelRecording}>
              {t('new.cancel')}
            </button>
            <button className="btn primary" data-testid="macro-stop" onClick={() => endRecording()}>
              {t('macro.stop')}
            </button>
          </>
        ) : (
          <>
            <button className="btn primary" data-testid="macro-record" onClick={beginRecording}>
              <span className="rec-dot" aria-hidden="true" />
              {t('macro.record')}
            </button>
            <span className="spacer" />
            <button
              className="ib small"
              title={t('macro.import')}
              aria-label={t('macro.import')}
              onClick={() => void importMacro()}
            >
              <Icon name="import" size={14} />
            </button>
          </>
        )}
      </div>
      {!macros.length && !recording && <p className="note small">{t('macro.help')}</p>}
      <ul className="macro-list">
        {macros.map((m) => (
          <li key={m.id} className={open === m.id ? 'open' : undefined}>
            <div className="macro-row">
              <button
                className="ib small"
                aria-expanded={open === m.id}
                aria-label={t('macro.steps')}
                onClick={() => setOpen(open === m.id ? null : m.id)}
              >
                <Icon name={open === m.id ? 'chevronDown' : 'chevron'} size={12} />
              </button>
              {editing === m.id ? (
                <input
                  className="macro-name"
                  autoFocus
                  defaultValue={m.name}
                  aria-label={t('macro.rename')}
                  onBlur={(e) => {
                    renameMacro(m.id, e.target.value);
                    setEditing(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                />
              ) : (
                <span
                  className="macro-name"
                  onDoubleClick={() => setEditing(m.id)}
                  title={t('macro.renameHint')}
                >
                  {m.name}
                </span>
              )}
              <button
                className="ib small"
                data-testid={`macro-play-${m.name}`}
                title={t('macro.play')}
                aria-label={t('macro.play')}
                disabled={recording}
                onClick={() => void playMacro(m.id)}
              >
                <Icon name="play" size={14} />
              </button>
              <button
                className="ib small"
                title={t('macro.export')}
                aria-label={t('macro.export')}
                onClick={() => void exportMacro(m.id)}
              >
                <Icon name="export" size={14} />
              </button>
              <button
                className="ib small"
                title={t('macro.delete')}
                aria-label={t('macro.delete')}
                onClick={() => deleteMacro(m.id)}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
            {open === m.id && (
              <ol className="macro-steps">
                {m.steps.map((s, i) => (
                  <li key={i}>
                    <span>{stepLabel(s)}</span>
                    <button
                      className="ib small"
                      aria-label={t('macro.removeStep')}
                      title={t('macro.removeStep')}
                      onClick={() => removeStep(m.id, i)}
                    >
                      <Icon name="close" size={10} />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
