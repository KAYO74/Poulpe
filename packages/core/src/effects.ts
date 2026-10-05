import type { Effect, EffectType, SceneNode } from './types';

/*
 * Effets de calque (ombres, lueurs, flou), dessinés par le rendu et traduits en filtres SVG.
 * Les flous sont donnés en rayon : l'écart type de la gaussienne vaut la moitié du rayon,
 * comme pour les ombres du canevas.
 */

export const EFFECT_TYPES: EffectType[] = [
  'dropShadow',
  'innerShadow',
  'outerGlow',
  'innerGlow',
  'bevel',
  'blur',
];

/** Effet par défaut de chaque type, quand on l'active dans le panneau. */
export function defaultEffect(type: EffectType): Effect {
  switch (type) {
    case 'dropShadow':
      return { type, enabled: true, color: '#00000066', x: 0, y: 8, blur: 16 };
    case 'innerShadow':
      return { type, enabled: true, color: '#00000080', x: 0, y: 4, blur: 8 };
    case 'outerGlow':
      return { type, enabled: true, color: '#ffd25fcc', blur: 24 };
    case 'innerGlow':
      return { type, enabled: true, color: '#ffffffcc', blur: 12 };
    case 'bevel':
      return {
        type,
        enabled: true,
        style: 'bevel',
        angle: 135,
        depth: 6,
        softness: 4,
        intensity: 70,
        light: '#ffffff',
        shadow: '#000000',
      };
    case 'blur':
      return { type, enabled: true, radius: 8 };
  }
}

/** Effets actifs d'un objet, dans l'ordre de dessin. */
export function activeEffects(node: Pick<SceneNode, 'effects'>): Effect[] {
  if (!node.effects?.length) return [];
  return EFFECT_TYPES.map((t) => node.effects!.find((e) => e.type === t && e.enabled)).filter(
    (e): e is Effect => !!e,
  );
}

export function findEffect<T extends EffectType>(
  node: Pick<SceneNode, 'effects'>,
  type: T,
): Extract<Effect, { type: T }> | undefined {
  return node.effects?.find((e) => e.type === type) as Extract<Effect, { type: T }> | undefined;
}

/** Marge autour de l'objet que les effets peuvent atteindre, en pixels du document. */
export function effectMargin(effects: Effect[]): number {
  let m = 0;
  for (const e of effects) {
    if (e.type === 'dropShadow') m = Math.max(m, Math.max(Math.abs(e.x), Math.abs(e.y)) + e.blur * 1.5);
    else if (e.type === 'outerGlow') m = Math.max(m, e.blur * 1.5);
    else if (e.type === 'blur') m = Math.max(m, e.radius * 1.5);
    else if (e.type === 'bevel') m = Math.max(m, e.style === 'bevel' ? e.depth + e.softness + 2 : 2);
    else m = Math.max(m, 2);
  }
  return Math.ceil(m);
}
