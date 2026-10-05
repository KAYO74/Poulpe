import { useEffect, useRef, useState } from 'react';
import { FORMAT_PRESETS, type FormatCategory } from '@poulpe/core';
import { TEMPLATES } from '@poulpe/library';
import { COMMANDS, TOOL_KEYS, formatShortcut } from '../commands';
import { discardDraft, getPendingDraft, restoreDraft } from '../drafts';
import { getLang, useT } from '../i18n';
import { exportDocument, newDocument, openDocument, type ExportOptions } from '../io';
import { newFromTemplate, resizeDesign } from '../libraryActions';
import { TemplateCard } from '../panels/Library';
import { setSettings, ui, useEditor, useUi } from '../store';
import { NumberField, Select } from './fields';
import { Icon } from './Icon';

function Modal({
  title,
  children,
  onClose,
  wide,
  xl,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  xl?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input, select, button.primary, button')?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal${wide ? ' wide' : ''}${xl ? ' xl' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          e.stopPropagation();
        }}
      >
        <header>
          <h2>{title}</h2>
          <button className="ib" aria-label={t('common.close')} onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

const close = () => ui.set({ dialog: null });

type NewSection = 'templates' | FormatCategory;

/**
 * Écran d'accueil et « Nouveau document » : modèles prêts à l'emploi, formats par usage (réseaux
 * sociaux, impression, écran) et taille personnalisée.
 */
function NewDialog() {
  const t = useT();
  const showWelcome = useUi((s) => s.settings.showWelcome);
  const [section, setSection] = useState<NewSection>('templates');
  const [preset, setPreset] = useState('portrait');
  const [size, setSize] = useState({ width: 1080, height: 1350 });
  const [format, setFormat] = useState<string | null>(null);
  const formats = section === 'templates' ? [] : FORMAT_PRESETS.filter((f) => f.category === section);
  const templates = TEMPLATES.filter((d) => !format || d.format === format);
  const usedFormats = [...new Set(TEMPLATES.map((d) => d.format))];
  return (
    <Modal title={t('new.welcome')} onClose={close} xl>
      <div className="new-layout">
        <nav className="new-nav" aria-label={t('new.title')}>
          <button aria-pressed={section === 'templates'} onClick={() => setSection('templates')}>
            <Icon name="template" />
            {t('new.templates')}
          </button>
          <span className="new-nav-head">{t('new.formats')}</span>
          {(['social', 'print', 'screen'] as const).map((c) => (
            <button
              key={c}
              aria-pressed={section === c}
              data-testid={`new-${c}`}
              onClick={() => setSection(c)}
            >
              <Icon name={c === 'social' ? 'photo' : c === 'print' ? 'layout' : 'artboard'} />
              {t(`library.cat.${c}`)}
            </button>
          ))}
          <span className="spacer" />
          <button onClick={() => void openDocument()}>
            <Icon name="folder" />
            {t('new.open')}
          </button>
        </nav>
        <div className="new-main">
          {section === 'templates' ? (
            <>
              <div className="chips" role="group">
                <button className="chip-btn" aria-pressed={format === null} onClick={() => setFormat(null)}>
                  {t('library.all')}
                </button>
                {usedFormats.map((f) => (
                  <button
                    key={f}
                    className="chip-btn"
                    aria-pressed={format === f}
                    onClick={() => setFormat(f)}
                  >
                    {t(`format.${f}`)}
                  </button>
                ))}
              </div>
              <div className="tpl-grid wide">
                {templates.map((d) => (
                  <TemplateCard key={d.id} def={d} onPick={newFromTemplate} />
                ))}
              </div>
            </>
          ) : (
            <div className="preset-grid">
              {formats.map((f) => (
                <button
                  key={f.id}
                  className={`preset${preset === f.id ? ' on' : ''}`}
                  data-testid={`preset-${f.id}`}
                  onClick={() => {
                    setPreset(f.id);
                    setSize({ width: f.width, height: f.height });
                  }}
                  onDoubleClick={() => newDocument(f.width, f.height)}
                >
                  <span className="preset-shape" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
                  <b>{t(`format.${f.id}`)}</b>
                  <span className="num">
                    {f.width} × {f.height}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <footer className="new-footer">
        <label className="check">
          <input
            type="checkbox"
            checked={showWelcome}
            onChange={(e) => setSettings({ showWelcome: e.target.checked })}
          />
          {t('new.showAtStartup')}
        </label>
        <span className="spacer" />
        <span className="muted">{t('new.custom2')}</span>
        <NumberField
          label={t('new.width')}
          value={size.width}
          min={1}
          max={20000}
          unit="px"
          width={120}
          onChange={(v) => (setPreset('custom'), setSize({ ...size, width: v }))}
        />
        <NumberField
          label={t('new.height')}
          value={size.height}
          min={1}
          max={20000}
          unit="px"
          width={120}
          onChange={(v) => (setPreset('custom'), setSize({ ...size, height: v }))}
        />
        <button
          className="btn primary"
          data-testid="new-create"
          onClick={() => newDocument(size.width, size.height)}
        >
          {t('new.blank')}
        </button>
      </footer>
    </Modal>
  );
}

function ResizeDialog() {
  const t = useT();
  const { doc, activeArtboardId } = useEditor();
  const ab = doc.artboards.find((a) => a.id === activeArtboardId) ?? doc.artboards[0];
  const [size, setSize] = useState({ width: 1080, height: 1920 });
  const [preset, setPreset] = useState<string>('story');
  const [copy, setCopy] = useState(true);
  if (!ab) return null;
  return (
    <Modal title={t('resize.title')} onClose={close} wide>
      <p className="note">{t('resize.current', { w: Math.round(ab.width), h: Math.round(ab.height) })}</p>
      {(['social', 'print', 'screen'] as const).map((c) => (
        <div key={c}>
          <h4 className="sub">{t(`library.cat.${c}`)}</h4>
          <div className="preset-grid compact">
            {FORMAT_PRESETS.filter((f) => f.category === c).map((f) => (
              <button
                key={f.id}
                className={`preset${preset === f.id ? ' on' : ''}`}
                data-testid={`resize-${f.id}`}
                onClick={() => {
                  setPreset(f.id);
                  setSize({ width: f.width, height: f.height });
                }}
              >
                <span className="preset-shape" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
                <b>{t(`format.${f.id}`)}</b>
                <span className="num">
                  {f.width} × {f.height}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="picker-row">
        <NumberField
          label={t('new.width')}
          value={size.width}
          min={1}
          max={20000}
          unit="px"
          width={130}
          onChange={(v) => (setPreset('custom'), setSize({ ...size, width: v }))}
        />
        <NumberField
          label={t('new.height')}
          value={size.height}
          min={1}
          max={20000}
          unit="px"
          width={130}
          onChange={(v) => (setPreset('custom'), setSize({ ...size, height: v }))}
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={copy} onChange={(e) => setCopy(e.target.checked)} />
        {t('resize.copy')}
      </label>
      <p className="note small">{t('resize.hint')}</p>
      <footer>
        <button className="btn" onClick={close}>
          {t('new.cancel')}
        </button>
        <button
          className="btn primary"
          data-testid="resize-go"
          onClick={() =>
            resizeDesign(
              size.width,
              size.height,
              copy,
              preset !== 'custom' ? `${ab.name} · ${t(`format.${preset}`)}` : undefined,
            )
          }
        >
          <Icon name="resize" />
          {t('resize.go')}
        </button>
      </footer>
    </Modal>
  );
}

function ExportDialog() {
  const t = useT();
  const { doc, activeArtboardId } = useEditor();
  const [opts, setOpts] = useState<ExportOptions>({
    kind: 'png',
    artboardId: activeArtboardId,
    scale: 1,
    quality: 0.92,
    transparent: false,
  });
  const [busy, setBusy] = useState(false);
  const raster = opts.kind === 'png' || opts.kind === 'jpeg';
  return (
    <Modal title={t('export.title')} onClose={close}>
      <div className="seg full" role="group" aria-label={t('export.format')}>
        {(['png', 'jpeg', 'svg', 'pdf'] as const).map((k) => (
          <button
            key={k}
            aria-pressed={opts.kind === k}
            data-testid={`export-${k}`}
            onClick={() => setOpts({ ...opts, kind: k })}
          >
            {k.toUpperCase()}
          </button>
        ))}
      </div>
      <Select
        label={t('export.artboard')}
        value={opts.artboardId}
        options={[
          ...doc.artboards.map((a) => ({ value: a.id, label: `${a.name} · ${a.width} × ${a.height}` })),
          ...(doc.artboards.length > 1 ? [{ value: 'all', label: t('export.allArtboards') }] : []),
        ]}
        onChange={(v) => setOpts({ ...opts, artboardId: v })}
      />
      {raster && (
        <div className="picker-row">
          <Select
            label={t('export.scale')}
            value={opts.scale}
            options={[0.5, 1, 2, 3, 4].map((s) => ({ value: s, label: `${s}×` }))}
            onChange={(v) => setOpts({ ...opts, scale: v })}
            width={110}
          />
          {opts.kind === 'jpeg' && (
            <NumberField
              label={t('export.quality')}
              value={Math.round(opts.quality * 100)}
              min={10}
              max={100}
              unit="%"
              width={110}
              onChange={(v) => setOpts({ ...opts, quality: v / 100 })}
            />
          )}
        </div>
      )}
      {(opts.kind === 'png' || opts.kind === 'svg') && (
        <label className="check">
          <input
            type="checkbox"
            checked={opts.transparent}
            onChange={(e) => setOpts({ ...opts, transparent: e.target.checked })}
          />
          {t('export.transparent')}
        </label>
      )}
      {opts.kind === 'pdf' && <p className="note">{t('export.pdfFonts')}</p>}
      <footer>
        <button className="btn" onClick={close}>
          {t('new.cancel')}
        </button>
        <button
          className="btn primary"
          data-testid="export-go"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await exportDocument(opts);
              close();
            } finally {
              setBusy(false);
            }
          }}
        >
          <Icon name="export" />
          {t('export.go')}
        </button>
      </footer>
    </Modal>
  );
}

function ShortcutsDialog() {
  const t = useT();
  const rows = Object.values(COMMANDS).filter((c) => 'shortcut' in c && c.shortcut) as {
    label: string;
    shortcut: string;
  }[];
  return (
    <Modal title={t('shortcuts.title')} onClose={close} wide>
      <div className="shortcuts">
        <table>
          <tbody>
            {Object.entries(TOOL_KEYS).map(([k, tool]) => (
              <tr key={k}>
                <td>{t(`tool.${tool}`)}</td>
                <td>
                  <kbd>{k.toUpperCase()}</kbd>
                </td>
              </tr>
            ))}
            <tr>
              <td>{t('tool.hand')}</td>
              <td>
                <kbd>Espace</kbd>
              </td>
            </tr>
          </tbody>
        </table>
        <table>
          <tbody>
            {rows.map((c) => (
              <tr key={c.label}>
                <td>{t(c.label)}</td>
                <td>
                  <kbd>{formatShortcut(c.shortcut)}</kbd>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function AboutDialog() {
  const t = useT();
  return (
    <Modal title={t('help.about')} onClose={close}>
      <p>{t('help.aboutText', { version: __APP_VERSION__ })}</p>
    </Modal>
  );
}

function DraftDialog() {
  const t = useT();
  const draft = getPendingDraft();
  if (!draft) return null;
  const date = new Date(draft.savedAt).toLocaleString(getLang() === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  return (
    <Modal title={t('draft.title')} onClose={discardDraft}>
      <p>{t('draft.body', { name: draft.doc.name, date })}</p>
      <footer>
        <button className="btn" onClick={discardDraft}>
          {t('draft.discard')}
        </button>
        <button className="btn primary" data-testid="draft-restore" onClick={restoreDraft}>
          {t('draft.restore')}
        </button>
      </footer>
    </Modal>
  );
}

export function Dialogs() {
  const dialog = useUi((s) => s.dialog);
  if (dialog === 'new') return <NewDialog />;
  if (dialog === 'export') return <ExportDialog />;
  if (dialog === 'shortcuts') return <ShortcutsDialog />;
  if (dialog === 'about') return <AboutDialog />;
  if (dialog === 'draft') return <DraftDialog />;
  if (dialog === 'resize') return <ResizeDialog />;
  return null;
}
