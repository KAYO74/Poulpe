import { findNode, type TextNode, type TextStyle } from '@poulpe/core';
import { setTextStyle, updateSelected } from '../actions';
import { NumberField, Select } from '../components/fields';
import { Icon, type IconName } from '../components/Icon';
import { WEIGHTS, useFonts } from '../fonts';
import { useT } from '../i18n';
import { editingStyle } from '../canvas/textEdit';
import { useEditor, useTextSelection, useUi } from '../store';

export function CharacterPanel() {
  const t = useT();
  const fonts = useFonts();
  const { doc, selection } = useEditor();
  const defaults = useUi((s) => s.defaults);
  useTextSelection();
  const text = selection.map((id) => findNode(doc, id)?.node).find((n): n is TextNode => n?.type === 'text');
  // Pendant l'édition, les réglages montrés sont ceux du début de la sélection.
  const st: TextStyle = editingStyle() ?? text?.style ?? defaults.text;
  const toggle = (key: 'italic' | 'underline' | 'strike' | 'uppercase', icon: IconName, label: string) => (
    <button
      className="ib"
      aria-pressed={st[key]}
      title={label}
      aria-label={label}
      onClick={() => setTextStyle({ [key]: !st[key] })}
    >
      <Icon name={icon} />
    </button>
  );
  const align = (value: TextStyle['align'], icon: IconName, label: string) => (
    <button
      className="ib"
      aria-pressed={st.align === value}
      title={label}
      aria-label={label}
      onClick={() => setTextStyle({ align: value })}
    >
      <Icon name={icon} />
    </button>
  );
  const families = fonts.includes(st.fontFamily) ? fonts : [st.fontFamily, ...fonts];
  return (
    <div className="panel-body">
      {!text && <p className="empty">{t('char.noText')}</p>}
      <Select
        label={t('char.font')}
        value={st.fontFamily}
        options={families.map((f) => ({ value: f, label: f }))}
        onChange={(f) => setTextStyle({ fontFamily: f })}
      />
      <div className="picker-row">
        <Select
          label={t('char.weight')}
          value={st.fontWeight}
          options={WEIGHTS.map((w) => ({ value: w, label: String(w) }))}
          onChange={(w) => setTextStyle({ fontWeight: w })}
          width={110}
        />
        <NumberField
          label={t('char.size')}
          value={st.fontSize}
          min={1}
          max={2000}
          unit="px"
          decimals={1}
          width={100}
          onChange={(v) => setTextStyle({ fontSize: v })}
          testId="font-size"
        />
      </div>
      <div className="picker-row">
        <NumberField
          label={t('char.tracking')}
          value={st.letterSpacing}
          min={-100}
          max={500}
          unit="px"
          decimals={1}
          width={110}
          onChange={(v) => setTextStyle({ letterSpacing: v })}
        />
        <NumberField
          label={t('char.leading')}
          value={Math.round(st.lineHeight * 100)}
          min={50}
          max={400}
          unit="%"
          width={100}
          onChange={(v) => setTextStyle({ lineHeight: v / 100 })}
        />
      </div>
      <div className="picker-row">
        <button
          className="ib"
          aria-pressed={st.fontWeight >= 700}
          title={t('char.bold')}
          aria-label={t('char.bold')}
          onClick={() => setTextStyle({ fontWeight: st.fontWeight >= 700 ? 400 : 700 })}
        >
          <Icon name="bold" />
        </button>
        {toggle('italic', 'italic', t('char.italic'))}
        {toggle('underline', 'underline', t('char.underline'))}
        {toggle('strike', 'strike', t('char.strike'))}
        {toggle('uppercase', 'caps', t('char.uppercase'))}
        <span className="tsep" />
        {align('left', 'textLeft', t('char.alignLeft'))}
        {align('center', 'textCenter', t('char.alignCenter'))}
        {align('right', 'textRight', t('char.alignRight'))}
        {align('justify', 'textJustify', t('char.justify'))}
      </div>
      {text && (
        <label className="check">
          <input
            type="checkbox"
            checked={text.autoWidth}
            onChange={(e) =>
              updateSelected(
                'history.text',
                (n) => void (n.type === 'text' && (n.autoWidth = e.target.checked)),
              )
            }
          />
          {t('char.autoWidth')}
        </label>
      )}
    </div>
  );
}
