/**
 * Modèle de document Poulpe (format `.poulpe`, version 1).
 *
 * Toutes les coordonnées sont en pixels, dans l'espace du document (« monde ») :
 * les objets d'un plan de travail ne sont pas relatifs à ce plan de travail.
 * Un objet est une boîte (x, y, width, height) tournée de `rotation` degrés autour de son centre.
 */

/** Couleur CSS hexadécimale : `#rrggbb` ou `#rrggbbaa`. */
export type Color = string;

export interface GradientStop {
  /** Position de 0 à 1. */
  offset: number;
  color: Color;
}

export type Paint =
  | { type: 'none' }
  | { type: 'solid'; color: Color }
  /** `angle` en degrés : 0 = de gauche à droite, 90 = de haut en bas. */
  | { type: 'linear'; stops: GradientStop[]; angle: number }
  /** Centre et rayon en fractions de la boîte de l'objet. */
  | { type: 'radial'; stops: GradientStop[]; cx: number; cy: number; r: number };

export interface Stroke {
  paint: Paint;
  width: number;
}

export const BLEND_MODES = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
] as const;
export type BlendMode = (typeof BLEND_MODES)[number];

interface NodeBase {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrés, sens horaire, autour du centre de la boîte. */
  rotation: number;
  /** 0 à 1. */
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
}

interface Styled {
  fill: Paint;
  stroke: Stroke;
}

export interface RectNode extends NodeBase, Styled {
  type: 'rect';
  cornerRadius: number;
}

export interface EllipseNode extends NodeBase, Styled {
  type: 'ellipse';
}

export interface PolygonNode extends NodeBase, Styled {
  type: 'polygon';
  sides: number;
}

export interface StarNode extends NodeBase, Styled {
  type: 'star';
  points: number;
  /** Rayon intérieur / rayon extérieur, de 0.05 à 1. */
  innerRatio: number;
}

export interface LineNode extends NodeBase, Styled {
  type: 'line';
  /** 1 : du coin haut gauche au coin bas droit ; -1 : du coin bas gauche au coin haut droit. */
  direction: 1 | -1;
}

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  align: TextAlign;
  /** Multiplicateur de la taille de police. */
  lineHeight: number;
  /** Interlettrage en pixels. */
  letterSpacing: number;
  underline: boolean;
  strike: boolean;
  uppercase: boolean;
}

export interface TextNode extends NodeBase, Styled {
  type: 'text';
  text: string;
  style: TextStyle;
  /** Texte artistique : la largeur suit le texte. Sinon bloc de texte : le texte passe à la ligne. */
  autoWidth: boolean;
}

export interface ImageNode extends NodeBase {
  type: 'image';
  assetId: string;
}

export interface GroupNode extends NodeBase {
  type: 'group';
  /** Du dessous vers le dessus. */
  children: SceneNode[];
  /** Masque d'écrêtage : l'objet du dessous découpe les autres. */
  clip: boolean;
}

export type ShapeNode = RectNode | EllipseNode | PolygonNode | StarNode | LineNode;
export type SceneNode = ShapeNode | TextNode | ImageNode | GroupNode;
export type NodeType = SceneNode['type'];

export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  background: Paint;
  /** Du dessous vers le dessus. */
  children: SceneNode[];
}

export interface Asset {
  id: string;
  mime: string;
  width: number;
  height: number;
  /** Données encodées en `data:` URL. Dans le fichier `.poulpe`, stockées dans `assets/images/`. */
  data: string;
}

export interface PoulpeDocument {
  format: 'poulpe';
  version: number;
  id: string;
  name: string;
  artboards: Artboard[];
  /** Nuancier du document. */
  swatches: Color[];
  assets: Record<string, Asset>;
}

export type Parent = Artboard | GroupNode;
