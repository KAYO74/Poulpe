import type { TextNode, TextStyle } from './types';

/** Mesure la largeur d'une chaîne (sans interlettrage) dans la police CSS donnée. */
export type MeasureText = (text: string, font: string) => number;

export interface TextLine {
  text: string;
  /** Largeur, interlettrage compris. */
  width: number;
}

export interface TextLayout {
  lines: TextLine[];
  lineHeight: number;
  width: number;
  height: number;
}

export function cssFont(style: TextStyle): string {
  const family = /[\s,'"]/.test(style.fontFamily)
    ? `"${style.fontFamily.replace(/"/g, '')}"`
    : style.fontFamily;
  return `${style.italic ? 'italic ' : ''}${style.fontWeight} ${style.fontSize}px ${family}, sans-serif`;
}

export function displayText(node: Pick<TextNode, 'text' | 'style'>): string {
  return node.style.uppercase ? node.text.toUpperCase() : node.text;
}

/** Mesure qui ne dépend d'aucun navigateur (tests, environnements sans canevas). */
export const approximateMeasure: MeasureText = (text, font) => {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 16);
  return text.length * size * 0.55;
};

/** Découpe le texte en lignes ; passe à la ligne sur les espaces quand `maxWidth` est donné. */
export function layoutText(
  node: Pick<TextNode, 'text' | 'style' | 'autoWidth' | 'width'>,
  measure: MeasureText,
): TextLayout {
  const { style } = node;
  const font = cssFont(style);
  const spacing = style.letterSpacing;
  const w = (s: string) => (s ? measure(s, font) + spacing * s.length : 0);
  const maxWidth = node.autoWidth ? Infinity : Math.max(1, node.width);
  const lines: TextLine[] = [];
  for (const para of displayText(node).split('\n')) {
    if (!isFinite(maxWidth)) {
      lines.push({ text: para, width: w(para) });
      continue;
    }
    const words = para.split(/(\s+)/);
    let current = '';
    for (const token of words) {
      if (!token) continue;
      const candidate = current + token;
      if (current && !/^\s+$/.test(token) && w(candidate) > maxWidth) {
        lines.push({ text: current.trimEnd(), width: w(current.trimEnd()) });
        current = token;
        // Un mot plus long que la ligne est coupé lettre par lettre.
        while (w(current) > maxWidth && current.length > 1) {
          let cut = current.length - 1;
          while (cut > 1 && w(current.slice(0, cut)) > maxWidth) cut--;
          lines.push({ text: current.slice(0, cut), width: w(current.slice(0, cut)) });
          current = current.slice(cut);
        }
      } else {
        current = candidate;
      }
    }
    lines.push({ text: current.trimEnd(), width: w(current.trimEnd()) });
  }
  const lineHeight = style.fontSize * style.lineHeight;
  const width = isFinite(maxWidth) ? maxWidth : Math.max(1, ...lines.map((l) => l.width));
  return { lines, lineHeight, width, height: Math.max(lineHeight, lines.length * lineHeight) };
}

/** Abscisse de début d'une ligne selon l'alignement. */
export function lineOffset(layout: TextLayout, line: TextLine, align: TextStyle['align']): number {
  if (align === 'center') return (layout.width - line.width) / 2;
  if (align === 'right') return layout.width - line.width;
  return 0;
}

/** Position verticale de la ligne de base de la ligne `i`, depuis le haut de la boîte. */
export function baselineY(layout: TextLayout, style: TextStyle, i: number): number {
  const half = (layout.lineHeight - style.fontSize) / 2;
  return i * layout.lineHeight + half + style.fontSize * 0.8;
}
