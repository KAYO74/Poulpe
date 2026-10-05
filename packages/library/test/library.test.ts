import { describe, expect, it } from 'vitest';
import {
  artboardToSvg,
  commandsBounds,
  decodePoulpe,
  encodePoulpe,
  findFormat,
  parseSvgPath,
  shapePath,
  walkDocument,
} from '@poulpe/core';
import {
  FONT_PAIRINGS,
  FRAMES,
  ICONS,
  ICON_CATEGORIES,
  ILLUSTRATIONS,
  PALETTES,
  SHAPES,
  TEMPLATES,
  iconMatches,
  templateDocument,
} from '../src';

const BUNDLED = [
  'Inter',
  'Montserrat',
  'Playfair Display',
  'Lora',
  'Oswald',
  'Bricolage Grotesque',
  'Pacifico',
];

describe('modèles', () => {
  it('ont un format connu et un identifiant unique', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) expect(findFormat(t.format), t.id).toBeTruthy();
  });

  for (const lang of ['fr', 'en'] as const) {
    it(`se construisent en ${lang}, avec des polices fournies et des ids uniques`, () => {
      for (const def of TEMPLATES) {
        const doc = templateDocument(def, lang);
        const nodes = [...walkDocument(doc)].map((l) => l.node);
        expect(nodes.length, def.id).toBeGreaterThan(2);
        expect(new Set(nodes.map((n) => n.id)).size, def.id).toBe(nodes.length);
        for (const n of nodes) {
          expect(Number.isFinite(n.x + n.y + n.width + n.height), `${def.id} ${n.name}`).toBe(true);
          if (n.type === 'text') {
            expect(BUNDLED, `${def.id} ${n.text}`).toContain(n.style.fontFamily);
            expect(n.text.length).toBeGreaterThan(0);
          }
        }
        // Le document s'exporte et se relit.
        expect(artboardToSvg(doc, doc.artboards[0])).toContain('<svg');
        expect(decodePoulpe(encodePoulpe(doc)).artboards[0].children.length).toBe(
          doc.artboards[0].children.length,
        );
      }
    });
  }

  it('les textes diffèrent entre français et anglais', () => {
    const texts = (lang: 'fr' | 'en') =>
      TEMPLATES.flatMap((d) =>
        [...walkDocument(templateDocument(d, lang))].flatMap((l) =>
          l.node.type === 'text' ? [l.node.text] : [],
        ),
      ).join('|');
    expect(texts('fr')).not.toBe(texts('en'));
  });
});

describe('éléments', () => {
  it('les icônes se lisent et remplissent leur carré', () => {
    expect(ICONS.length).toBeGreaterThan(150);
    for (const i of ICONS) {
      expect(ICON_CATEGORIES[i.category], i.id).toBeTruthy();
      const b = commandsBounds(parseSvgPath(i.d))!;
      expect(b, i.id).toBeTruthy();
      expect(b.x).toBeGreaterThanOrEqual(-1);
      expect(b.x + b.width).toBeLessThanOrEqual(257);
    }
  });

  it('la recherche d’icônes marche en français et en anglais, sans accents', () => {
    const find = (q: string) => ICONS.filter((i) => iconMatches(i, q)).map((i) => i.id);
    expect(find('coeur')).toContain('heart');
    expect(find('heart')).toContain('heart');
    expect(find('fleche')).toContain('arrow-right');
    expect(find('zzzz')).toEqual([]);
  });

  it('formes, cadres et illustrations tiennent dans leur taille annoncée', () => {
    for (const s of [...SHAPES, ...FRAMES]) {
      const n = s.build('#123456');
      expect(Math.abs(n.width - s.width), s.id).toBeLessThan(1);
      expect(Math.abs(n.height - s.height), s.id).toBeLessThan(1);
      if (n.type === 'path') {
        const b = commandsBounds(shapePath(n))!;
        expect(b.x, s.id).toBeGreaterThan(-1);
        expect(b.y, s.id).toBeGreaterThan(-1);
        expect(b.x + b.width, s.id).toBeLessThan(n.width + 1);
        expect(b.y + b.height, s.id).toBeLessThan(n.height + 1);
      }
    }
    for (const il of ILLUSTRATIONS) {
      const n = il.build('fr');
      expect(n.type, il.id).toBe('group');
      expect(n.x + n.width, il.id).toBeLessThan(il.width * 1.15);
      expect(n.y + n.height, il.id).toBeLessThan(il.height * 1.15);
    }
  });

  it('palettes et polices', () => {
    for (const p of PALETTES) {
      expect(p.colors.length).toBeGreaterThanOrEqual(4);
      for (const c of p.colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const f of FONT_PAIRINGS) {
      expect(BUNDLED).toContain(f.title.font);
      expect(BUNDLED).toContain(f.body.font);
    }
  });
});
