import { useState } from 'react';
import { useT } from '../i18n';
import { setSettings, ui, useUi } from '../store';
import { installUpdate, pendingUpdate } from '../updater';
import { Modal } from './Dialogs';

const close = () => ui.set({ dialog: null });

/** Une nouvelle version est disponible : notes de version, installation et redémarrage. */
export function UpdateDialog() {
  const t = useT();
  const auto = useUi((s) => s.settings.autoUpdate);
  const [progress, setProgress] = useState<number | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const info = pendingUpdate();
  if (!info) return null;
  const busy = progress !== undefined && !failed;
  return (
    <Modal title={t('update.title')} onClose={() => !busy && close()}>
      <p>{t('update.available', { version: info.version, current: info.current })}</p>
      {info.notes && <pre className="update-notes">{info.notes}</pre>}
      {busy && (
        <p className="update-progress" role="status">
          {t('update.downloading')}
          {progress !== null && ` ${Math.round(progress * 100)} %`}
        </p>
      )}
      {failed && (
        <p className="error" role="alert">
          {t('update.error')}
        </p>
      )}
      <footer>
        <label className="check">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setSettings({ autoUpdate: e.target.checked })}
          />
          {t('update.auto')}
        </label>
        <span className="spacer" />
        <button className="btn" disabled={busy} onClick={close}>
          {t('update.later')}
        </button>
        <button
          className="btn primary"
          disabled={busy}
          onClick={() => {
            setFailed(false);
            setProgress(null);
            installUpdate(setProgress).catch((e) => {
              console.error(e);
              setFailed(true);
            });
          }}
        >
          {t('update.install')}
        </button>
      </footer>
    </Modal>
  );
}
