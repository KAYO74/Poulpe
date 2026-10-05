// Génère src/icons.generated.ts à partir des icônes Phosphor (licence MIT), style « fill ».
// Usage : pnpm --filter @poulpe/library icons
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../node_modules/@phosphor-icons/core');
const { icons: catalog } = await import(join(root, 'dist/index.mjs'));
const list = JSON.parse(readFileSync(join(here, 'icons-list.json'), 'utf8'));
const tags = new Map(catalog.map((i) => [i.name, i.tags.filter((t) => !t.startsWith('*'))]));

const out = [];
for (const [category, items] of Object.entries(list)) {
  for (const [name, fr] of Object.entries(items)) {
    const svg = readFileSync(join(root, 'assets/fill', `${name}-fill.svg`), 'utf8');
    const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
    if (!paths.length || /<(rect|circle|ellipse|line|polygon|polyline)\b/.test(svg))
      throw new Error(`${name} : seuls les tracés <path> sont pris en charge`);
    const en = [name.replace(/-logo$/, '').replace(/-/g, ' '), ...(tags.get(name) ?? [])].join(' ');
    out.push({ id: name, category, fr, en, d: paths.join(' ') });
  }
}

const body = out
  .map(
    (i) =>
      `  { id: ${JSON.stringify(i.id)}, category: ${JSON.stringify(i.category)}, fr: ${JSON.stringify(i.fr)}, en: ${JSON.stringify(i.en)}, d: ${JSON.stringify(i.d)} },`,
  )
  .join('\n');
writeFileSync(
  join(here, '../src/icons.generated.ts'),
  `// Fichier généré par scripts/build-icons.mjs : ne pas modifier à la main.
// Icônes Phosphor (https://phosphoricons.com), © 2023 Phosphor Icons, licence MIT (voir LICENSE-icons.md).
import type { IconDef } from './icons';

export const ICON_DATA: IconDef[] = [
${body}
];
`,
);
console.log(`${out.length} icônes`);
