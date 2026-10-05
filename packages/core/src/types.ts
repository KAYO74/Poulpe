/**
 * Modèle de document Poulpe (format `.poulpe`, version 2).
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

/** Réglages de caractère qui peuvent varier à l'intérieur d'un même texte. */
export interface RunStyle {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  letterSpacing?: number;
  /** Couleur unie qui remplace le remplissage du texte. */
  color?: Color;
}

/** Plage de caractères `[start, end)` (indices UTF-16 dans `text`) et ce qui la distingue du style du texte. */
export interface TextRun {
  start: number;
  end: number;
  style: RunStyle;
}

export interface TextNode extends NodeBase, Styled {
  type: 'text';
  text: string;
  /** Style du texte entier (paragraphe et caractères). */
  style: TextStyle;
  /** Styles par caractère, triés et sans chevauchement. Absent : tout le texte suit `style`. */
  runs?: TextRun[];
  /** Texte artistique : la largeur suit le texte. Sinon bloc de texte : le texte passe à la ligne. */
  autoWidth: boolean;
}

/**
 * Tracé libre (icônes, formes de la bibliothèque) : données de tracé SVG exprimées dans `viewBox`,
 * étirées pour remplir la boîte de l'objet.
 */
export interface PathNode extends NodeBase, Styled {
  type: 'path';
  /** Attribut `d` d'un tracé SVG. */
  d: string;
  /** Repère des données `d` : ce rectangle est ramené sur la boîte de l'objet. */
  viewBox: { x: number; y: number; width: number; height: number };
  /** Règle de remplissage des tracés qui se recoupent (`nonzero` par défaut). */
  fillRule?: 'nonzero' | 'evenodd';
}

/** Rectangle en fractions (0 à 1) de l'image source. */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageNode extends NodeBase {
  type: 'image';
  assetId: string;
  /** Partie de l'image affichée dans la boîte de l'objet. Absent : l'image entière. */
  crop?: Crop;
}

export interface GroupNode extends NodeBase {
  type: 'group';
  /** Du dessous vers le dessus. */
  children: SceneNode[];
  /** Masque d'écrêtage : l'objet du dessous découpe les autres. */
  clip: boolean;
}

export type ShapeNode = RectNode | EllipseNode | PolygonNode | StarNode | LineNode | PathNode;
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
  /** Repères tirés depuis les règles, en coordonnées du document. */
  guides?: { x: number[]; y: number[] };
  assets: Record<string, Asset>;
}

export type Parent = Artboard | GroupNode;
