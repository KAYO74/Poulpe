import { commandsBounds, parseSvgPath, type SceneNode } from '@poulpe/core';
import { circle, ellipse, group, path, polygon, rect, star, tr, type Tr } from './dsl';
import { ICONS, ICON_VIEWBOX } from './icons';

/*
 * Formes et cadres photo de la bibliothèque, dessinés pour Poulpe (même licence que l'appli).
 * Les tracés sont écrits dans un repère de 100 unités de large.
 */

export interface ShapeDef {
  id: string;
  name: Tr;
  /** Taille naturelle, avant mise à l'échelle sur le plan de travail. */
  width: number;
  height: number;
  build: (color: string) => SceneNode;
}

const P = (
  id: string,
  fr: string,
  en: string,
  d: string,
  vb: [number, number] | [number, number, number, number],
  o: { evenodd?: boolean } = {},
): ShapeDef => {
  // Repère ajusté au plus près du tracé, pour que la boîte de l'objet colle à la forme.
  const b = commandsBounds(parseSvgPath(d))!;
  vb = [b.x, b.y, b.width, b.height];
  const w = 100,
    h = (100 * b.height) / b.width;
  return {
    id,
    name: tr(fr, en),
    width: w * 3,
    height: h * 3,
    build: (color) => path(d, vb, 0, 0, w * 3, h * 3, color, { name: fr, evenodd: o.evenodd }),
  };
};

const HEART =
  'M50 92C20 70 0 52 0 30C0 13 13 2 27 2C38 2 46 8 50 17C54 8 62 2 73 2C87 2 100 13 100 30C100 52 80 70 50 92Z';
const BLOB = 'M79 11C93 23 100 42 96 60C91 79 73 95 51 98C29 100 9 87 3 67C0 47 6 26 21 14C37 2 64 0 79 11Z';

/** Anneau entre deux demi-cercles (pour les arcs-en-ciel). */
export function halfRingPath(r1: number, r2: number): string {
  const x2 = r1 * 2;
  const g = r1 - r2;
  return `M0 ${r1}A${r1} ${r1} 0 0 1 ${x2} ${r1}H${x2 - g}A${r2} ${r2} 0 0 0 ${g} ${r1}Z`;
}

export const SHAPES: ShapeDef[] = [
  {
    id: 'square',
    name: tr('Carré', 'Square'),
    width: 300,
    height: 300,
    build: (c) => rect(0, 0, 300, 300, c, { name: 'Carré' }),
  },
  {
    id: 'rounded',
    name: tr('Carré arrondi', 'Rounded square'),
    width: 300,
    height: 300,
    build: (c) => rect(0, 0, 300, 300, c, { radius: 48, name: 'Carré arrondi' }),
  },
  {
    id: 'pill',
    name: tr('Pilule', 'Pill'),
    width: 400,
    height: 140,
    build: (c) => rect(0, 0, 400, 140, c, { radius: 70, name: 'Pilule' }),
  },
  {
    id: 'circle',
    name: tr('Cercle', 'Circle'),
    width: 300,
    height: 300,
    build: (c) => circle(150, 150, 150, c, { name: 'Cercle' }),
  },
  P('triangle', 'Triangle', 'Triangle', 'M50 0L100 100H0Z', [100, 100]),
  P('rightTriangle', 'Triangle rectangle', 'Right triangle', 'M0 0L100 100H0Z', [100, 100]),
  P('diamond', 'Losange', 'Diamond', 'M50 0L100 50L50 100L0 50Z', [100, 100]),
  {
    id: 'hexagon',
    name: tr('Hexagone', 'Hexagon'),
    width: 300,
    height: 300,
    build: (c) => polygon(0, 0, 300, 300, c, { sides: 6, name: 'Hexagone' }),
  },
  {
    id: 'star',
    name: tr('Étoile', 'Star'),
    width: 300,
    height: 300,
    build: (c) => star(0, 0, 300, 300, c, { name: 'Étoile' }),
  },
  {
    id: 'seal',
    name: tr('Badge', 'Seal'),
    width: 300,
    height: 300,
    build: (c) => star(0, 0, 300, 300, c, { points: 24, inner: 0.86, name: 'Badge' }),
  },
  {
    id: 'burst',
    name: tr('Explosion', 'Burst'),
    width: 300,
    height: 300,
    build: (c) => star(0, 0, 300, 300, c, { points: 14, inner: 0.7, name: 'Explosion' }),
  },
  P(
    'sparkle',
    'Scintillement',
    'Sparkle',
    'M50 0C54 30 70 46 100 50C70 54 54 70 50 100C46 70 30 54 0 50C30 46 46 30 50 0Z',
    [100, 100],
  ),
  P('heart', 'Cœur', 'Heart', HEART, [0, 2, 100, 90]),
  P('arrow', 'Flèche', 'Arrow', 'M0 35H60V10L100 50L60 90V65H0Z', [0, 10, 100, 80]),
  P('arrowThin', 'Flèche fine', 'Thin arrow', 'M0 10H84V0L100 14L84 28V18H0Z', [100, 28]),
  P(
    'arrowDouble',
    'Double flèche',
    'Double arrow',
    'M0 50L30 15V35H70V15L100 50L70 85V65H30V85Z',
    [0, 15, 100, 70],
  ),
  P('chevron', 'Chevron', 'Chevron', 'M0 0H60L100 50L60 100H0L40 50Z', [100, 100]),
  P('ribbon', 'Ruban', 'Ribbon', 'M0 0H100L88 25L100 50H0L12 25Z', [100, 50]),
  P(
    'bubble',
    'Bulle carrée',
    'Square bubble',
    'M12 0H88A12 12 0 0 1 100 12V62A12 12 0 0 1 88 74H40L18 96L22 74H12A12 12 0 0 1 0 62V12A12 12 0 0 1 12 0Z',
    [100, 96],
  ),
  P(
    'bubbleRound',
    'Bulle ronde',
    'Round bubble',
    'M50 0C77.6 0 100 19.7 100 44S77.6 88 50 88C43 88 36.4 86.8 30.4 84.6L8 96L14.8 74C5.5 66.1 0 55.6 0 44C0 19.7 22.4 0 50 0Z',
    [100, 96],
  ),
  P(
    'cloud',
    'Nuage',
    'Cloud',
    'M24 76C10.7 76 0 65.3 0 52C0 39.6 9.4 29.4 21.5 28.1C24.7 12.1 38.9 0 56 0C73.4 0 87.8 12.6 90.4 29.2C96.2 33.3 100 40.1 100 47.8C100 63.4 87.8 76 72.8 76Z',
    [100, 76],
  ),
  P(
    'drop',
    'Goutte',
    'Drop',
    'M50 0C70 30 90 48 90 68A40 40 0 0 1 10 68C10 48 30 30 50 0Z',
    [10, 0, 80, 108],
  ),
  P('lightning', 'Éclair', 'Lightning', 'M60 0L10 58H45L35 100L90 38H55Z', [10, 0, 80, 100]),
  P(
    'moon',
    'Croissant de lune',
    'Crescent moon',
    'M62 2A48 48 0 1 0 98 66A40 40 0 1 1 62 2Z',
    [2, 2, 96, 96],
  ),
  P('cross', 'Croix', 'Cross', 'M35 0H65V35H100V65H65V100H35V65H0V35H35Z', [100, 100]),
  P('halfCircle', 'Demi-cercle', 'Half circle', 'M0 50A50 50 0 0 1 100 50Z', [100, 50]),
  P('quarter', 'Quart de cercle', 'Quarter circle', 'M0 0A100 100 0 0 1 100 100H0Z', [100, 100]),
  P('arch', 'Arche', 'Arch', 'M0 100V50A50 50 0 0 1 100 50V100Z', [100, 100]),
  P(
    'ring',
    'Anneau',
    'Ring',
    'M0 50A50 50 0 1 1 100 50A50 50 0 1 1 0 50Z M25 50A25 25 0 1 0 75 50A25 25 0 1 0 25 50Z',
    [100, 100],
    { evenodd: true },
  ),
  P('frameSquare', 'Cadre', 'Frame', 'M0 0H100V100H0Z M10 10V90H90V10Z', [100, 100], { evenodd: true }),
  P('wave', 'Vague', 'Wave', 'M0 30C17 10 33 10 50 30S83 50 100 30V100H0Z', [0, 15, 100, 85]),
  P('blob1', 'Tache 1', 'Blob 1', BLOB, [100, 100]),
  P(
    'blob2',
    'Tache 2',
    'Blob 2',
    'M55 2C75 4 92 16 98 34C100 52 92 70 80 84C66 98 44 100 26 92C10 84 0 66 2 48C4 28 14 12 30 5C38 2 46 1 55 2Z',
    [100, 100],
  ),
  P(
    'blob3',
    'Tache 3',
    'Blob 3',
    'M20 8C36 0 52 10 66 6C82 2 98 12 99 30C100 48 86 56 88 72C90 90 72 100 54 96C38 92 30 82 16 80C2 78 0 60 2 44C4 28 6 16 20 8Z',
    [100, 100],
  ),
];

/*
 * Cadres photo : un groupe avec masque d'écrêtage. La forme du dessous découpe ce qu'il y a
 * au-dessus ; déposer une image sur le cadre la place dedans.
 */

const imageIcon = ICONS.find((i) => i.id === 'image')!;

export function frameContent(mask: SceneNode): SceneNode[] {
  const s = Math.min(mask.width, mask.height) * 0.28;
  return [
    mask,
    path(
      imageIcon.d,
      [ICON_VIEWBOX, ICON_VIEWBOX],
      mask.x + (mask.width - s) / 2,
      mask.y + (mask.height - s) / 2,
      s,
      s,
      '#8b95a1',
      {
        name: 'Image',
      },
    ),
  ];
}

export const FRAME_FILL = '#d5dae1';

function frame(id: string, fr: string, en: string, w: number, h: number, mask: () => SceneNode): ShapeDef {
  return {
    id,
    name: tr(fr, en),
    width: w,
    height: h,
    build: () => {
      const m = mask();
      m.name = fr;
      return group(frameContent(m), 'Cadre photo', { clip: true });
    },
  };
}

export const FRAMES: ShapeDef[] = [
  frame('frameRect', 'Cadre rectangle', 'Rectangle frame', 400, 300, () => rect(0, 0, 400, 300, FRAME_FILL)),
  frame('framePortrait', 'Cadre portrait', 'Portrait frame', 300, 400, () =>
    rect(0, 0, 300, 400, FRAME_FILL),
  ),
  frame('frameRounded', 'Cadre arrondi', 'Rounded frame', 340, 340, () =>
    rect(0, 0, 340, 340, FRAME_FILL, { radius: 40 }),
  ),
  frame('frameCircle', 'Cadre rond', 'Circle frame', 340, 340, () => ellipse(0, 0, 340, 340, FRAME_FILL)),
  frame('frameArch', 'Cadre arche', 'Arch frame', 300, 400, () =>
    path('M0 100V50A50 50 0 0 1 100 50V100Z', [100, 100], 0, 0, 300, 400, FRAME_FILL),
  ),
  frame('frameBlob', 'Cadre organique', 'Blob frame', 360, 360, () =>
    path(BLOB, [100, 100], 0, 0, 360, 360, FRAME_FILL),
  ),
  frame('frameHeart', 'Cadre cœur', 'Heart frame', 360, 324, () =>
    path(HEART, [0, 2, 100, 90], 0, 0, 360, 324, FRAME_FILL),
  ),
];
