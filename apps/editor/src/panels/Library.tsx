import { useMemo, useState } from 'react';
import { findFormat, type FormatCategory } from '@poulpe/core';
import {
  FONT_PAIRINGS,
  FRAMES,
  ICONS,
  ICON_CATEGORIES,
  ILLUSTRATIONS,
  PALETTES,
  SHAPES,
  TEMPLATES,
  TEXT_PRESETS,
  fold,
  iconMatches,
  iconName,
  templateDocument,
  type TemplateDef,
} from '@poulpe/library';
import { Icon } from '../components/Icon';
import { DocThumb, NodeSvg, nodeDocument } from '../components/Thumb';
import { getLang, useT } from '../i18n';
import { importImage } from '../io';
import {
  addElement,
  addPaletteToSwatches,
  applyFontPairing,
  applyPaletteToDesign,
  applyTemplate,
  type ElementKind,
} from '../libraryActions';
import { setSettings, ui, useEditor } from '../store';
import { paintPreview } from '../components/fields';
import {
  applySavedStyle,
  createSymbol,
  deleteStyle,
  deleteSymbol,
  placeSymbol,
  saveStyle,
} from '../symbolActions';

/*
 * Panneau Bibliothèque, le côté Canva de Poulpe : modèles, éléments (textes, formes, cadres,
 * illustrations, icônes, photos) et styles (palettes, combinaisons de polices). Il s'ancre du côté
 * opposé au Studio, comme un Studio d'Affinity.
 */

type Tab = 'templates' | 'elements' | 'styles';

export const ELEMENT_MIME = 'application/x-poulpe-element';

function dragProps(kind: ElementKind, id: string) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(ELEMENT_MIME, JSON.stringify({ kind, id }));
      e.dataTransfer.effectAllowed = 'copy';
    },
  };
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <label className="lib-search">
      <Icon name="search" size={14} />
      <input
        type="search"
        value={value}
        placeholder={t('library.search')}
        aria-label={t('library.search')}
        data-testid="library-search"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </label>
  );
}

export function TemplateCard({ def, onPick }: { def: TemplateDef; onPick: (d: TemplateDef) => void }) {
  const t = useT();
  const lang = getLang();
  const f = findFormat(def.format)!;
  return (
    <button
      className="tpl-card"
      data-testid={`template-${def.id}`}
      title={`${def.name[lang]} · ${t(`format.${f.id}`)}`}
      onClick={() => onPick(def)}
    >
      <span className="tpl-thumb">
        <DocThumb
          cacheKey={`tpl:${def.id}:${lang}`}
          make={() => templateDocument(def, lang)}
          maxW={240}
          maxH={240}
          alt={def.name[lang]}
        />
      </span>
      <b>{def.name[lang]}</b>
      <span className="muted">{t(`format.${f.id}`)}</span>
    </button>
  );
}

function TemplatesTab() {
  const t = useT();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<FormatCategory | 'all'>('all');
  const list = TEMPLATES.filter((d) => {
    const f = findFormat(d.format)!;
    if (cat !== 'all' && f.category !== cat) return false;
    const hay = fold(`${d.name.fr} ${d.name.en} ${d.tags} ${t(`format.${f.id}`)}`);
    return fold(q)
      .split(/\s+/)
      .every((w) => hay.includes(w));
  });
  return (
    <div className="lib-body">
      <SearchBox value={q} onChange={setQ} />
      <div className="chips" role="group">
        {(['all', 'social', 'print', 'screen'] as const).map((c) => (
          <button key={c} className="chip-btn" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {t(c === 'all' ? 'library.all' : `library.cat.${c}`)}
          </button>
        ))}
      </div>
      <p className="note small">{t('library.templateHint')}</p>
      <div className="tpl-grid">
        {list.map((d) => (
          <TemplateCard key={d.id} def={d} onPick={applyTemplate} />
        ))}
      </div>
      {!list.length && <p className="empty">{t('library.noResult', { q })}</p>}
    </div>
  );
}

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="lib-section">
      <h4 className="sub">{title}</h4>
      {hint && <p className="note small">{hint}</p>}
      {children}
    </section>
  );
}

function ElementsTab() {
  const t = useT();
  const lang = getLang();
  const [q, setQ] = useState('');
  const match = (s: string) =>
    fold(q)
      .split(/\s+/)
      .every((w) => fold(s).includes(w));
  const shapes = SHAPES.filter((s) => match(`${s.name.fr} ${s.name.en}`));
  const frames = FRAMES.filter((s) => match(`${s.name.fr} ${s.name.en} cadre photo frame`));
  const ills = ILLUSTRATIONS.filter((s) => match(`${s.name.fr} ${s.name.en} illustration`));
  const icons = ICONS.filter((i) => iconMatches(i, q));
  const shapeNodes = useMemo(() => new Map(SHAPES.map((s) => [s.id, s.build('#8b95a1')])), []);
  const frameNodes = useMemo(() => new Map(FRAMES.map((s) => [s.id, s.build('#000')])), []);
  const byCategory = Object.keys(ICON_CATEGORIES)
    .map((c) => [c, icons.filter((i) => i.category === c)] as const)
    .filter(([, l]) => l.length);
  const nothing = !shapes.length && !frames.length && !ills.length && !icons.length;
  return (
    <div className="lib-body">
      <SearchBox value={q} onChange={setQ} />
      <p className="note small">{t('library.dragHint')}</p>
      {!q && (
        <Section title={t('library.text')}>
          <div className="text-presets">
            {TEXT_PRESETS.map((p) => (
              <button
                key={p.id}
                className={`text-preset ${p.id}`}
                data-testid={`text-${p.id}`}
                onClick={() => addElement('text', p.id)}
                {...dragProps('text', p.id)}
              >
                {p.name[lang]}
              </button>
            ))}
          </div>
        </Section>
      )}
      {shapes.length > 0 && (
        <Section title={t('library.shapes')}>
          <div className="el-grid">
            {shapes.map((s) => (
              <button
                key={s.id}
                className="el"
                title={s.name[lang]}
                aria-label={s.name[lang]}
                data-testid={`shape-${s.id}`}
                onClick={() => addElement('shape', s.id)}
                {...dragProps('shape', s.id)}
              >
                <NodeSvg node={shapeNodes.get(s.id)!} label={s.name[lang]} />
              </button>
            ))}
          </div>
        </Section>
      )}
      {frames.length > 0 && (
        <Section title={t('library.frames')} hint={t('library.framesHint')}>
          <div className="el-grid">
            {frames.map((s) => (
              <button
                key={s.id}
                className="el"
                title={s.name[lang]}
                aria-label={s.name[lang]}
                data-testid={`frame-${s.id}`}
                onClick={() => addElement('frame', s.id)}
                {...dragProps('frame', s.id)}
              >
                <NodeSvg node={frameNodes.get(s.id)!} label={s.name[lang]} />
              </button>
            ))}
          </div>
        </Section>
      )}
      {ills.length > 0 && (
        <Section title={t('library.illustrations')}>
          <div className="ill-grid">
            {ills.map((s) => (
              <button
                key={s.id}
                className="el ill"
                title={s.name[lang]}
                aria-label={s.name[lang]}
                data-testid={`illustration-${s.id}`}
                onClick={() => addElement('illustration', s.id)}
                {...dragProps('illustration', s.id)}
              >
                <DocThumb
                  cacheKey={`ill:${s.id}:${lang}`}
                  make={() => nodeDocument(s.build(lang), 10)}
                  maxW={120}
                  maxH={90}
                  alt={s.name[lang]}
                />
              </button>
            ))}
          </div>
        </Section>
      )}
      {byCategory.map(([c, list]) => (
        <Section key={c} title={`${t('library.icons')} · ${ICON_CATEGORIES[c][lang]}`}>
          <div className="icon-grid">
            {list.map((i) => (
              <button
                key={i.id}
                className="el icon"
                title={iconName(i, lang)}
                aria-label={iconName(i, lang)}
                data-testid={`icon-${i.id}`}
                onClick={() => addElement('icon', i.id)}
                {...dragProps('icon', i.id)}
              >
                <svg viewBox="0 0 256 256" width="22" height="22" aria-hidden="true">
                  <path d={i.d} fill="currentColor" />
                </svg>
              </button>
            ))}
          </div>
        </Section>
      ))}
      {!q && (
        <Section title={t('library.photos')} hint={t('library.photosHint')}>
          <button className="btn" onClick={() => void importImage()}>
            <Icon name="image" />
            {t('library.importPhoto')}
          </button>
        </Section>
      )}
      {nothing && <p className="empty">{t('library.noResult', { q })}</p>}
    </div>
  );
}

/** Styles enregistrés et symboles du document : ce que l'utilisateur a mis de côté lui-même. */
function DocumentAssets() {
  const t = useT();
  const { doc, selection } = useEditor();
  const styles = doc.styles ?? [];
  const symbols = Object.values(doc.symbols ?? {});
  return (
    <>
      <Section title={t('library.docStyles')} hint={t('library.docStylesHint')}>
        {styles.length === 0 && <p className="empty">{t('library.noStyle')}</p>}
        {styles.map((s) => (
          <div className="asset-row" key={s.id} data-testid={`saved-style-${s.id}`}>
            <button onClick={() => applySavedStyle(s.id)} title={t('library.applyStyle')}>
              <span
                className="style-preview"
                style={{ background: paintPreview(s.fill ?? { type: 'none' }) }}
              />
              <span className="asset-name">{s.name}</span>
            </button>
            <button
              className="icon-btn"
              title={t('library.deleteStyle')}
              aria-label={t('library.deleteStyle')}
              onClick={() => deleteStyle(s.id)}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}
        <button
          className="chip-btn"
          disabled={selection.length !== 1}
          data-testid="save-style"
          onClick={() => saveStyle()}
        >
          {t('library.saveStyle')}
        </button>
      </Section>
      <Section title={t('library.symbols')} hint={t('library.symbolsHint')}>
        {symbols.length === 0 && <p className="empty">{t('library.noSymbol')}</p>}
        {symbols.map((s) => (
          <div className="asset-row" key={s.id} data-testid={`symbol-${s.id}`}>
            <button onClick={() => placeSymbol(s.id)} title={t('library.placeSymbol')}>
              <Icon name="symbol" size={14} />
              <span className="asset-name">{s.name}</span>
            </button>
            <button
              className="icon-btn"
              title={t('library.deleteSymbol')}
              aria-label={t('library.deleteSymbol')}
              onClick={() => deleteSymbol(s.id)}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        ))}
        <button
          className="chip-btn"
          disabled={selection.length === 0}
          data-testid="create-symbol"
          onClick={() => createSymbol()}
        >
          {t('library.createSymbol')}
        </button>
      </Section>
    </>
  );
}

function StylesTab() {
  const t = useT();
  const lang = getLang();
  return (
    <div className="lib-body">
      <DocumentAssets />
      <Section title={t('library.palettes')} hint={t('library.palettesHint')}>
        <div className="palettes">
          {PALETTES.map((p) => (
            <div key={p.id} className="palette-row">
              <button
                className="palette"
                data-testid={`palette-${p.id}`}
                title={p.name[lang]}
                onClick={() => applyPaletteToDesign(p)}
              >
                <span className="palette-strip">
                  {p.colors.map((c) => (
                    <span key={c} style={{ background: c }} />
                  ))}
                </span>
                <span className="palette-name">{p.name[lang]}</span>
              </button>
              <button
                className="ib small"
                title={t('library.addToSwatches')}
                aria-label={t('library.addToSwatches')}
                onClick={() => addPaletteToSwatches(p)}
              >
                <Icon name="plus" size={12} />
              </button>
            </div>
          ))}
        </div>
      </Section>
      <Section title={t('library.fonts')} hint={t('library.fontsHint')}>
        <div className="pairings">
          {FONT_PAIRINGS.map((p) => (
            <button
              key={p.id}
              className="pairing"
              data-testid={`pairing-${p.id}`}
              onClick={() => applyFontPairing(p)}
            >
              <span
                className="pairing-title"
                style={{
                  fontFamily: `"${p.title.font}"`,
                  fontWeight: p.title.weight,
                  fontStyle: p.title.italic ? 'italic' : 'normal',
                  textTransform: p.title.upper ? 'uppercase' : 'none',
                  letterSpacing: p.title.spacing ? `${p.title.spacing}em` : undefined,
                }}
              >
                {p.name[lang]}
              </span>
              <span
                className="pairing-body"
                style={{
                  fontFamily: `"${p.body.font}"`,
                  fontWeight: p.body.weight,
                  fontStyle: p.body.italic ? 'italic' : 'normal',
                }}
              >
                {t('library.fontSample')}
              </span>
              <span className="pairing-names">
                {p.title.font} · {p.body.font}
              </span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

export function Library() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('templates');
  return (
    <aside className="library" aria-label={t('library.title')} data-testid="library">
      <header className="studio-tabs" role="tablist">
        {(['templates', 'elements', 'styles'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className="studio-tab"
            data-testid={`lib-tab-${id}`}
            onClick={() => setTab(id)}
          >
            {t(`library.${id}`)}
          </button>
        ))}
        <span className="spacer" />
        <button
          className="ib small"
          title={t('library.resize')}
          aria-label={t('library.resize')}
          onClick={() => ui.set({ dialog: 'resize' })}
        >
          <Icon name="resize" size={14} />
        </button>
        <button
          className="ib small"
          title={t('library.close')}
          aria-label={t('library.close')}
          onClick={() => setSettings({ library: false })}
        >
          <Icon name="close" size={12} />
        </button>
      </header>
      <div className="studio-content" role="tabpanel">
        {tab === 'templates' && <TemplatesTab />}
        {tab === 'elements' && <ElementsTab />}
        {tab === 'styles' && <StylesTab />}
      </div>
    </aside>
  );
}
