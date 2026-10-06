import type { Persona, ToolId } from './store';

/* Outils de chaque Persona et catalogue complet, pour la colonne d'outils et les espaces de travail. */

export const DRAW_GROUPS: ToolId[][] = [
  ['select', 'direct', 'artboard'],
  ['pen', 'pencil'],
  ['rect', 'ellipse', 'polygon', 'star', 'line'],
  ['scissors', 'knife', 'corner', 'shapeBuilder'],
  ['text', 'image'],
  ['eyedropper', 'hand', 'zoom'],
];

export const PHOTO_GROUPS: ToolId[][] = [
  ['select', 'straighten', 'perspective'],
  ['marqueeRect', 'marqueeEllipse', 'lasso', 'polyLasso', 'magicWand', 'quickSelect'],
  ['brush', 'eraser', 'fill'],
  ['magicEraser', 'heal', 'clone'],
  ['dodge', 'burn', 'blurBrush', 'sharpenBrush', 'smudge', 'liquify'],
  ['text'],
  ['eyedropper', 'hand', 'zoom'],
];

/** Outils d'une Persona, par groupe (pour la colonne et la boîte « Espace de travail »). */
export function toolGroupsFor(persona: Persona): ToolId[][] {
  return persona === 'photo' ? PHOTO_GROUPS : DRAW_GROUPS;
}

const DRAW_TOOLS = new Set(DRAW_GROUPS.flat());
const PHOTO_TOOLS = new Set(PHOTO_GROUPS.flat());

/**
 * Tous les outils, rangés par famille, pour composer sa propre colonne dans un espace de travail
 * (vectoriel, pixel et le reste mélangés).
 */
export const TOOL_CATALOG: { id: 'select' | 'vector' | 'pixel' | 'other'; tools: ToolId[] }[] = [
  {
    id: 'select',
    tools: [
      'select',
      'direct',
      'artboard',
      'marqueeRect',
      'marqueeEllipse',
      'lasso',
      'polyLasso',
      'magicWand',
      'quickSelect',
    ],
  },
  {
    id: 'vector',
    tools: [
      'pen',
      'pencil',
      'rect',
      'ellipse',
      'polygon',
      'star',
      'line',
      'scissors',
      'knife',
      'corner',
      'shapeBuilder',
    ],
  },
  {
    id: 'pixel',
    tools: [
      'brush',
      'eraser',
      'fill',
      'magicEraser',
      'heal',
      'clone',
      'dodge',
      'burn',
      'blurBrush',
      'sharpenBrush',
      'smudge',
      'liquify',
      'straighten',
      'perspective',
    ],
  },
  { id: 'other', tools: ['text', 'image', 'eyedropper', 'hand', 'zoom'] },
];

/** Persona dont un outil a besoin pour fonctionner (null : utilisable partout). */
export function toolPersona(id: ToolId): 'draw' | 'photo' | null {
  if (PHOTO_TOOLS.has(id) && !DRAW_TOOLS.has(id)) return 'photo';
  if (DRAW_TOOLS.has(id) && !PHOTO_TOOLS.has(id)) return 'draw';
  return null;
}
