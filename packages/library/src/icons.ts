import { tr, type Lang, type Tr } from './dsl';
import { ICON_DATA } from './icons.generated';

/** Icône de la bibliothèque : un tracé dans un carré de 256 × 256. */
export interface IconDef {
  id: string;
  category: string;
  /** Mots-clés de recherche en français (le premier mot sert de nom). */
  fr: string;
  /** Nom et mots-clés en anglais. */
  en: string;
  d: string;
}

export const ICON_VIEWBOX = 256;

export const ICON_CATEGORIES: Record<string, Tr> = {
  symbols: tr('Symboles', 'Symbols'),
  arrows: tr('Flèches', 'Arrows'),
  communication: tr('Communication et réseaux', 'Communication and social'),
  commerce: tr('Commerce', 'Shopping'),
  media: tr('Médias et loisirs', 'Media and hobbies'),
  nature: tr('Nature et météo', 'Nature and weather'),
  food: tr('Cuisine', 'Food and drink'),
  travel: tr('Lieux et voyages', 'Places and travel'),
  work: tr('Travail et école', 'Work and school'),
  health: tr('Santé et sport', 'Health and sport'),
};

export const ICONS: IconDef[] = ICON_DATA;

export function iconName(icon: IconDef, lang: Lang): string {
  const words = lang === 'fr' ? icon.fr : icon.en;
  const first = lang === 'fr' ? words.split(' ')[0] : icon.id.replace(/-logo$/, '').replace(/-/g, ' ');
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** Ramène un texte de recherche à une forme simple : minuscules, sans accents. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae');
}

/** L'icône correspond-elle à la recherche (dans les deux langues) ? */
export function iconMatches(icon: IconDef, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  const hay = fold(`${icon.fr} ${icon.en} ${icon.id}`);
  return q.split(/\s+/).every((w) => hay.includes(w));
}
