import { useT } from '../i18n';
import { editor, useEditor } from '../store';

export function HistoryPanel() {
  const t = useT();
  const { history, historyIndex } = useEditor();
  return (
    <div className="panel-body">
      <ol className="history" aria-label={t('studio.history')}>
        {history.map((label, i) => (
          <li key={i}>
            <button
              className={`history-item${i === historyIndex ? ' on' : ''}${i > historyIndex ? ' future' : ''}`}
              aria-current={i === historyIndex ? 'step' : undefined}
              onClick={() => editor.goTo(i)}
            >
              {t(label)}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
