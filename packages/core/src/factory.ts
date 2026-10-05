import { newId } from './ids';
import type {
  Adjustment,
  AdjustmentNode,
  Artboard,
  EllipseNode,
  GroupNode,
  ImageNode,
  LineNode,
  Paint,
  PathNode,
  PoulpeDocument,
  PolygonNode,
  RectNode,
  SceneNode,
  StarNode,
  Stroke,
  TextNode,
  TextStyle,
} from './types';

export const FORMAT_VERSION = 7;

export type FormatCategory = 'social' | 'print' | 'screen';

export interface FormatPreset {
  id: string;
  category: FormatCategory;
  width: number;
  height: number;
}

/**
 * Formats prédéfinis ; leur nom affiché vient des traductions de l'interface (`format.<id>`).
 * Les formats d'impression sont à 300 dpi.
 */
export const FORMAT_PRESETS: FormatPreset[] = [
  { id: 'instagram', category: 'social', width: 1080, height: 1080 },
  { id: 'portrait', category: 'social', width: 1080, height: 1350 },
  { id: 'story', category: 'social', width: 1080, height: 1920 },
  { id: 'facebookPost', category: 'social', width: 1200, height: 630 },
  { id: 'facebookCover', category: 'social', width: 1640, height: 624 },
  { id: 'linkedinPost', category: 'social', width: 1200, height: 627 },
  { id: 'xPost', category: 'social', width: 1600, height: 900 },
  { id: 'pinterest', category: 'social', width: 1000, height: 1500 },
  { id: 'youtube', category: 'social', width: 1280, height: 720 },
  { id: 'youtubeBanner', category: 'social', width: 2560, height: 1440 },
  { id: 'a4', category: 'print', width: 2480, height: 3508 },
  { id: 'a5', category: 'print', width: 1748, height: 2480 },
  { id: 'a3', category: 'print', width: 3508, height: 4961 },
  { id: 'letter', category: 'print', width: 2550, height: 3300 },
  { id: 'businessCard', category: 'print', width: 1050, height: 600 },
  { id: 'postcard', category: 'print', width: 1800, height: 1200 },
  { id: 'invitation', category: 'print', width: 1500, height: 2100 },
  { id: 'presentation', category: 'screen', width: 1920, height: 1080 },
  { id: 'logo', category: 'screen', width: 1000, height: 1000 },
  { id: 'wallpaper', category: 'screen', width: 1170, height: 2532 },
];

export function findFormat(id: string): FormatPreset | undefined {
  return FORMAT_PRESETS.find((f) => f.id === id);
}

export const solid = (color: string): Paint => ({ type: 'solid', color });
export const NONE: Paint = { type: 'none' };

export interface Defaults {
  fill: Paint;
  stroke: Stroke;
  text: TextStyle;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter',
  fontSize: 48,
  fontWeight: 400,
  italic: false,
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
  underline: false,
  strike: false,
  uppercase: false,
};

export function defaultStyle(): Defaults {
  return {
    fill: solid('#2ba59a'),
    stroke: { paint: NONE, width: 4 },
    text: { ...DEFAULT_TEXT_STYLE },
  };
}

const base = (name: string, x: number, y: number, width: number, height: number) => ({
  id: newId(),
  name,
  x,
  y,
  width,
  height,
  rotation: 0,
  opacity: 1,
  blendMode: 'normal' as const,
  visible: true,
  locked: false,
});

type BoxArgs = { x: number; y: number; width: number; height: number; name?: string };

export function createRect(b: BoxArgs, d = defaultStyle()): RectNode {
  return {
    ...base(b.name ?? 'Rectangle', b.x, b.y, b.width, b.height),
    type: 'rect',
    fill: d.fill,
    stroke: d.stroke,
    cornerRadius: 0,
  };
}

export function createEllipse(b: BoxArgs, d = defaultStyle()): EllipseNode {
  return {
    ...base(b.name ?? 'Ellipse', b.x, b.y, b.width, b.height),
    type: 'ellipse',
    fill: d.fill,
    stroke: d.stroke,
  };
}

export function createPolygon(b: BoxArgs, d = defaultStyle(), sides = 6): PolygonNode {
  return {
    ...base(b.name ?? 'Polygone', b.x, b.y, b.width, b.height),
    type: 'polygon',
    fill: d.fill,
    stroke: d.stroke,
    sides,
  };
}

export function createStar(b: BoxArgs, d = defaultStyle(), points = 5, innerRatio = 0.5): StarNode {
  return {
    ...base(b.name ?? 'Étoile', b.x, b.y, b.width, b.height),
    type: 'star',
    fill: d.fill,
    stroke: d.stroke,
    points,
    innerRatio,
  };
}

export function createLine(b: BoxArgs & { direction?: 1 | -1 }, d = defaultStyle()): LineNode {
  const stroke: Stroke =
    d.stroke.paint.type === 'none' ? { paint: solid('#1a1a1d'), width: d.stroke.width } : d.stroke;
  return {
    ...base(b.name ?? 'Ligne', b.x, b.y, b.width, b.height),
    type: 'line',
    fill: NONE,
    stroke,
    direction: b.direction ?? 1,
  };
}

export function createText(
  b: BoxArgs & { text?: string; autoWidth?: boolean },
  d = defaultStyle(),
): TextNode {
  return {
    ...base(b.name ?? 'Texte', b.x, b.y, b.width, b.height),
    type: 'text',
    text: b.text ?? '',
    style: { ...d.text },
    fill: solid('#1a1a1d'),
    stroke: { paint: NONE, width: d.stroke.width },
    autoWidth: b.autoWidth ?? true,
  };
}

export function createPath(
  b: BoxArgs & { d: string; viewBox: PathNode['viewBox']; fillRule?: PathNode['fillRule'] },
  d = defaultStyle(),
): PathNode {
  return {
    ...base(b.name ?? 'Tracé', b.x, b.y, b.width, b.height),
    type: 'path',
    fill: d.fill,
    stroke: d.stroke,
    d: b.d,
    viewBox: { ...b.viewBox },
    ...(b.fillRule ? { fillRule: b.fillRule } : {}),
  };
}

export function createImage(b: BoxArgs & { assetId: string }): ImageNode {
  return { ...base(b.name ?? 'Image', b.x, b.y, b.width, b.height), type: 'image', assetId: b.assetId };
}

export function createAdjustment(b: BoxArgs & { adjustment: Adjustment }): AdjustmentNode {
  return {
    ...base(b.name ?? 'Réglage', b.x, b.y, b.width, b.height),
    type: 'adjustment',
    adjustment: b.adjustment,
  };
}

export function createGroup(children: SceneNode[], name = 'Groupe'): GroupNode {
  return { ...base(name, 0, 0, 0, 0), type: 'group', children, clip: false };
}

export function createArtboard(b: BoxArgs): Artboard {
  return {
    id: newId('ab'),
    name: b.name ?? 'Plan de travail',
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    background: solid('#ffffff'),
    children: [],
  };
}

export function createDocument(
  opts: { name?: string; width?: number; height?: number } = {},
): PoulpeDocument {
  return {
    format: 'poulpe',
    version: FORMAT_VERSION,
    id: newId('doc'),
    name: opts.name ?? 'Sans titre',
    artboards: [
      createArtboard({
        x: 0,
        y: 0,
        width: opts.width ?? 1080,
        height: opts.height ?? 1350,
        name: 'Plan de travail 1',
      }),
    ],
    swatches: ['#1a1a1d', '#ffffff', '#ff5f86', '#ff8a5b', '#ffd25f', '#2ba59a', '#4da3ff', '#7b61ff'],
    assets: {},
  };
}
