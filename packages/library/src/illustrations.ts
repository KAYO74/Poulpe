import type { SceneNode } from '@poulpe/core';
import { circle, ellipse, group, linear, path, radial, rect, text, tr, type Lang, type Tr } from './dsl';
import { halfRingPath } from './shapes';

/*
 * Illustrations vectorielles dessinées pour Poulpe (même licence que l'appli). Chacune est un
 * groupe d'objets ordinaires : on peut la dissocier, changer ses couleurs, la retoucher.
 */

export interface IllustrationDef {
  id: string;
  name: Tr;
  width: number;
  height: number;
  build: (lang: Lang) => SceneNode;
}

const SPARKLE = 'M50 0C54 30 70 46 100 50C70 54 54 70 50 100C46 70 30 54 0 50C30 46 46 30 50 0Z';
const HEART =
  'M50 92C20 70 0 52 0 30C0 13 13 2 27 2C38 2 46 8 50 17C54 8 62 2 73 2C87 2 100 13 100 30C100 52 80 70 50 92Z';
const CLOUD =
  'M24 76C10.7 76 0 65.3 0 52C0 39.6 9.4 29.4 21.5 28.1C24.7 12.1 38.9 0 56 0C73.4 0 87.8 12.6 90.4 29.2C96.2 33.3 100 40.1 100 47.8C100 63.4 87.8 76 72.8 76Z';
const WAVE = 'M0 30C17 10 33 10 50 30S83 50 100 30V100H0Z';
const LEAF = 'M50 0C80 20 92 55 50 100C8 55 20 20 50 0Z';
const BUBBLE =
  'M50 0C77.6 0 100 19.7 100 44S77.6 88 50 88C43 88 36.4 86.8 30.4 84.6L8 96L14.8 74C5.5 66.1 0 55.6 0 44C0 19.7 22.4 0 50 0Z';
const BLOBS = [
  'M79 11C93 23 100 42 96 60C91 79 73 95 51 98C29 100 9 87 3 67C0 47 6 26 21 14C37 2 64 0 79 11Z',
  'M55 2C75 4 92 16 98 34C100 52 92 70 80 84C66 98 44 100 26 92C10 84 0 66 2 48C4 28 14 12 30 5C38 2 46 1 55 2Z',
  'M20 8C36 0 52 10 66 6C82 2 98 12 99 30C100 48 86 56 88 72C90 90 72 100 54 96C38 92 30 82 16 80C2 78 0 60 2 44C4 28 6 16 20 8Z',
];

/** Suite pseudo-aléatoire reproductible (les illustrations sont identiques à chaque fois). */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const ILLUSTRATIONS: IllustrationDef[] = [
  {
    id: 'sunset',
    name: tr('Coucher de soleil', 'Sunset'),
    width: 400,
    height: 400,
    build: () =>
      group(
        [
          circle(200, 190, 150, linear(90, '#ffd25f', '#ff5f86'), { name: 'Soleil' }),
          path(WAVE, [0, 15, 100, 85], 0, 220, 400, 120, '#4da3ff', { name: 'Vague' }),
          path(WAVE, [0, 15, 100, 85], 0, 270, 400, 100, '#2b6cb0', { name: 'Vague' }),
          path(WAVE, [0, 15, 100, 85], 0, 320, 400, 80, '#13315c', { name: 'Vague' }),
        ],
        'Coucher de soleil',
      ),
  },
  {
    id: 'mountains',
    name: tr('Montagnes', 'Mountains'),
    width: 480,
    height: 320,
    build: () =>
      group(
        [
          circle(350, 90, 50, '#ffd25f', { name: 'Soleil' }),
          path('M0 100L35 30L55 60L70 40L100 100Z', [100, 100], 0, 60, 480, 260, '#9fb7d9', {
            name: 'Montagne',
          }),
          path('M0 100L40 20L80 100Z', [100, 100], 40, 40, 300, 280, '#3d5a80', { name: 'Montagne' }),
          path('M40 20L52 44L46 40L40 48L34 40L28 44Z', [100, 100], 40, 40, 300, 280, '#ffffff', {
            name: 'Neige',
          }),
          rect(0, 300, 480, 20, '#2f5d46', { name: 'Sol' }),
        ],
        'Montagnes',
      ),
  },
  {
    id: 'plant',
    name: tr('Plante en pot', 'Potted plant'),
    width: 260,
    height: 400,
    build: () => {
      const leaves = [
        [130, 60, 0],
        [80, 110, -40],
        [180, 110, 40],
        [60, 170, -65],
        [200, 170, 65],
      ].map(([x, y, r]) =>
        path(LEAF, [100, 100], x - 40, y - 60, 80, 130, '#3c8d7a', { rotation: r, name: 'Feuille' }),
      );
      return group(
        [
          rect(127, 120, 6, 140, '#2f5d46', { name: 'Tige' }),
          ...leaves,
          path('M0 0H100L86 100H14Z', [100, 100], 50, 250, 160, 150, '#c8553d', { name: 'Pot' }),
          rect(40, 240, 180, 30, '#e07a5f', { radius: 6, name: 'Bord du pot' }),
        ],
        'Plante en pot',
      );
    },
  },
  {
    id: 'clouds',
    name: tr('Soleil et nuages', 'Sun and clouds'),
    width: 440,
    height: 300,
    build: () =>
      group(
        [
          circle(270, 110, 90, '#ffd25f', { name: 'Soleil' }),
          path(CLOUD, [100, 76], 40, 120, 240, 182, '#dfe9f5', { name: 'Nuage' }),
          path(CLOUD, [100, 76], 250, 170, 180, 137, '#c7d6ea', { name: 'Nuage' }),
        ],
        'Soleil et nuages',
      ),
  },
  {
    id: 'confetti',
    name: tr('Confettis', 'Confetti'),
    width: 400,
    height: 400,
    build: () => {
      const r = rng(7);
      const colors = ['#ff5f86', '#ffd25f', '#4da3ff', '#2ba59a', '#7b61ff', '#ff8a5b'];
      const items: SceneNode[] = [];
      for (let i = 0; i < 36; i++) {
        const c = colors[i % colors.length];
        const x = r() * 380,
          y = r() * 380;
        if (i % 3 === 0) items.push(circle(x + 8, y + 8, 7, c, { name: 'Confetti' }));
        else
          items.push(
            rect(x, y, 10 + r() * 8, 22 + r() * 10, c, {
              radius: 3,
              rotation: r() * 180 - 90,
              name: 'Confetti',
            }),
          );
      }
      return group(items, 'Confettis');
    },
  },
  {
    id: 'hearts',
    name: tr('Cœurs', 'Hearts'),
    width: 400,
    height: 300,
    build: () =>
      group(
        [
          path(HEART, [0, 2, 100, 90], 20, 60, 200, 180, '#ff5f86', { rotation: -12, name: 'Cœur' }),
          path(HEART, [0, 2, 100, 90], 200, 20, 150, 135, '#f7a9c4', { rotation: 14, name: 'Cœur' }),
          path(HEART, [0, 2, 100, 90], 240, 180, 100, 90, '#d6336c', { rotation: 6, name: 'Cœur' }),
        ],
        'Cœurs',
      ),
  },
  {
    id: 'hello',
    name: tr('Bulle « Bonjour ! »', '“Hello!” bubble'),
    width: 400,
    height: 384,
    build: (lang) =>
      group(
        [
          path(BUBBLE, [100, 96], 0, 0, 400, 384, '#7b61ff', { name: 'Bulle' }),
          text(20, 120, 360, lang === 'fr' ? 'Bonjour !' : 'Hello!', '#ffffff', {
            font: 'Bricolage Grotesque',
            size: 84,
            weight: 700,
            align: 'center',
            name: 'Texte',
          }),
        ],
        'Bulle',
      ),
  },
  {
    id: 'sparkles',
    name: tr('Étincelles', 'Sparkles'),
    width: 360,
    height: 360,
    build: () =>
      group(
        [
          path(SPARKLE, [100, 100], 40, 60, 200, 200, '#ffd25f', { name: 'Étincelle' }),
          path(SPARKLE, [100, 100], 230, 20, 110, 110, '#ffb703', { name: 'Étincelle' }),
          path(SPARKLE, [100, 100], 240, 240, 80, 80, '#ffe8a3', { name: 'Étincelle' }),
        ],
        'Étincelles',
      ),
  },
  {
    id: 'rainbow',
    name: tr('Arc-en-ciel', 'Rainbow'),
    width: 400,
    height: 200,
    build: () => {
      const colors = ['#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#457b9d', '#7b61ff'];
      const band = 26;
      return group(
        colors.map((c, i) => {
          const r1 = 200 - i * band;
          return path(halfRingPath(r1, r1 - band), [r1 * 2, r1], i * band, i * band, r1 * 2, r1, c, {
            name: 'Bande',
          });
        }),
        'Arc-en-ciel',
      );
    },
  },
  {
    id: 'waves',
    name: tr('Vagues', 'Waves'),
    width: 600,
    height: 240,
    build: () =>
      group(
        [
          path(WAVE, [0, 15, 100, 85], 0, 0, 600, 240, '#8ee3d6', { name: 'Vague' }),
          path(WAVE, [0, 15, 100, 85], -60, 60, 660, 180, '#2ba59a', { name: 'Vague' }),
          path(WAVE, [0, 15, 100, 85], 0, 120, 600, 120, '#13315c', { name: 'Vague' }),
        ],
        'Vagues',
      ),
  },
  {
    id: 'blobs',
    name: tr('Taches de couleur', 'Colour blobs'),
    width: 420,
    height: 380,
    build: () =>
      group(
        [
          path(BLOBS[0], [100, 100], 0, 40, 260, 260, '#a0c4ff', { opacity: 0.9, name: 'Tache' }),
          path(BLOBS[1], [100, 100], 160, 0, 240, 240, '#f4a6c0', { opacity: 0.9, name: 'Tache' }),
          path(BLOBS[2], [100, 100], 150, 180, 200, 200, '#caffbf', { opacity: 0.9, name: 'Tache' }),
        ],
        'Taches',
      ),
  },
  {
    id: 'planet',
    name: tr('Planète', 'Planet'),
    width: 420,
    height: 300,
    build: () =>
      group(
        [
          circle(210, 150, 110, radial('#ffb5c8', '#7b61ff'), { name: 'Planète' }),
          ellipse(20, 120, 380, 60, undefined, { stroke: ['#ffd25f', 12], rotation: -12, name: 'Anneau' }),
          circle(60, 50, 8, '#ffd25f', { name: 'Étoile' }),
          circle(370, 260, 6, '#ffd25f', { name: 'Étoile' }),
          circle(380, 40, 10, '#ffd25f', { name: 'Étoile' }),
        ],
        'Planète',
      ),
  },
];
