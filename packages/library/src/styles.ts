import { tr, type Tr } from './dsl';

/** Palette de couleurs suggérée, de 4 à 5 couleurs. */
export interface Palette {
  id: string;
  name: Tr;
  colors: string[];
}

export const PALETTES: Palette[] = [
  {
    id: 'ocean',
    name: tr('Océan', 'Ocean'),
    colors: ['#0b2545', '#13315c', '#2ba59a', '#8ee3d6', '#f4f7f5'],
  },
  {
    id: 'sunset',
    name: tr('Coucher de soleil', 'Sunset'),
    colors: ['#2d1e2f', '#e0475c', '#f28f3b', '#ffd25f', '#fff4e0'],
  },
  {
    id: 'terracotta',
    name: tr('Terre cuite', 'Terracotta'),
    colors: ['#3d2b24', '#c8553d', '#e8a87c', '#f2d0a9', '#faf3ea'],
  },
  {
    id: 'forest',
    name: tr('Forêt', 'Forest'),
    colors: ['#1b2d24', '#2f5d46', '#7ba77e', '#d5e3c0', '#f7f5ec'],
  },
  {
    id: 'pastel',
    name: tr('Pastel', 'Pastel'),
    colors: ['#4a4e69', '#f4a6c0', '#a0c4ff', '#caffbf', '#fffaf0'],
  },
  { id: 'neon', name: tr('Néon', 'Neon'), colors: ['#0d0221', '#7b2cbf', '#ff3cac', '#2bd2ff', '#f5f3ff'] },
  {
    id: 'mono',
    name: tr('Noir et blanc', 'Black and white'),
    colors: ['#111111', '#444444', '#9a9a9a', '#e6e6e6', '#ffffff'],
  },
  {
    id: 'navy',
    name: tr('Marine et or', 'Navy and gold'),
    colors: ['#14213d', '#274472', '#c9a227', '#e5d4a1', '#fbf8f1'],
  },
  {
    id: 'citrus',
    name: tr('Agrumes', 'Citrus'),
    colors: ['#233d4d', '#fe7f2d', '#fcca46', '#a1c181', '#fffbf0'],
  },
  {
    id: 'berry',
    name: tr('Fruits rouges', 'Berry'),
    colors: ['#2b0f1e', '#8e1f4f', '#d6336c', '#f7a9c4', '#fff0f5'],
  },
  {
    id: 'nordic',
    name: tr('Nordique', 'Nordic'),
    colors: ['#2e3440', '#5e81ac', '#88c0d0', '#d8dee9', '#eceff4'],
  },
  {
    id: 'retro',
    name: tr('Rétro', 'Retro'),
    colors: ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51'],
  },
  {
    id: 'lavender',
    name: tr('Lavande', 'Lavender'),
    colors: ['#2f2a4a', '#6c5ce7', '#a29bfe', '#dcd6ff', '#f8f7ff'],
  },
  {
    id: 'coffee',
    name: tr('Café', 'Coffee'),
    colors: ['#2b1d16', '#6f4e37', '#b08968', '#e6ccb2', '#faf6f1'],
  },
  { id: 'mint', name: tr('Menthe', 'Mint'), colors: ['#1f3b36', '#3c8d7a', '#7fd1b9', '#d4f4e8', '#fbfffd'] },
  {
    id: 'candy',
    name: tr('Bonbon', 'Candy'),
    colors: ['#3a0ca3', '#f72585', '#ff9e00', '#4cc9f0', '#ffffff'],
  },
  {
    id: 'desert',
    name: tr('Désert', 'Desert'),
    colors: ['#40332b', '#a3623a', '#d9a066', '#eed9b6', '#fdf8ef'],
  },
  {
    id: 'poulpe',
    name: tr('Poulpe', 'Poulpe'),
    colors: ['#1a1a1d', '#7b61ff', '#ff5f86', '#ffd25f', '#ffffff'],
  },
];

/** Combinaison de polices : une pour les titres, une pour le texte courant. */
export interface FontPairing {
  id: string;
  name: Tr;
  /** `spacing` : interlettrage en fraction de la taille de police. */
  title: { font: string; weight: number; italic?: boolean; upper?: boolean; spacing?: number };
  body: { font: string; weight: number; italic?: boolean };
}

/** Seules des polices fournies avec Poulpe, pour que tout s'affiche et s'exporte partout. */
export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'elegant',
    name: tr('Élégant', 'Elegant'),
    title: { font: 'Playfair Display', weight: 700 },
    body: { font: 'Inter', weight: 400 },
  },
  {
    id: 'modern',
    name: tr('Moderne', 'Modern'),
    title: { font: 'Montserrat', weight: 800 },
    body: { font: 'Lora', weight: 400 },
  },
  {
    id: 'impact',
    name: tr('Percutant', 'Bold'),
    title: { font: 'Oswald', weight: 700, upper: true },
    body: { font: 'Inter', weight: 400 },
  },
  {
    id: 'creative',
    name: tr('Créatif', 'Creative'),
    title: { font: 'Bricolage Grotesque', weight: 700 },
    body: { font: 'Inter', weight: 400 },
  },
  {
    id: 'fun',
    name: tr('Festif', 'Playful'),
    title: { font: 'Pacifico', weight: 400 },
    body: { font: 'Montserrat', weight: 400 },
  },
  {
    id: 'editorial',
    name: tr('Éditorial', 'Editorial'),
    title: { font: 'Lora', weight: 700, italic: true },
    body: { font: 'Montserrat', weight: 400 },
  },
  {
    id: 'luxury',
    name: tr('Luxe', 'Luxury'),
    title: { font: 'Montserrat', weight: 400, upper: true, spacing: 0.3 },
    body: { font: 'Playfair Display', weight: 400, italic: true },
  },
  {
    id: 'simple',
    name: tr('Sobre', 'Simple'),
    title: { font: 'Inter', weight: 700 },
    body: { font: 'Inter', weight: 400 },
  },
];

/** Textes prêts à ajouter, comme « Ajouter un titre » dans Canva. */
export interface TextPreset {
  id: string;
  name: Tr;
  size: number;
  weight: number;
}

export const TEXT_PRESETS: TextPreset[] = [
  { id: 'heading', name: tr('Ajouter un titre', 'Add a heading'), size: 96, weight: 700 },
  { id: 'subheading', name: tr('Ajouter un sous-titre', 'Add a subheading'), size: 56, weight: 600 },
  { id: 'body', name: tr('Ajouter du texte', 'Add body text'), size: 32, weight: 400 },
];
