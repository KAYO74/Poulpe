import { expect, test, type Page } from '@playwright/test';

/* Panneaux libres : détacher, déplacer, redimensionner et ré-ancrer les fenêtres d'outils. */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('poulpe.settings'))
      localStorage.setItem('poulpe.settings', JSON.stringify({ showWelcome: false }));
  });
  await page.goto('/');
  await expect(page.getByTestId('canvas')).toBeVisible();
});

async function drag(page: Page, from: [number, number], to: [number, number]) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 12 });
  await page.mouse.up();
}

const center = async (page: Page, testId: string): Promise<[number, number]> => {
  const b = (await page.getByTestId(testId).boundingBox())!;
  return [b.x + b.width / 2, b.y + b.height / 2];
};

test('détache le groupe Calques, le déplace, le redimensionne et le ré-ancre', async ({ page }) => {
  const tabs = page.getByTestId('studio-studio-bottom').locator('.studio-tabs');
  const tb = (await tabs.boundingBox())!;
  // Glisser la barre d'onglets (à droite des onglets) vers le centre de l'écran.
  await drag(page, [tb.x + tb.width - 40, tb.y + 10], [600, 300]);
  const win = page.getByTestId('float-studio-bottom');
  await expect(win).toBeVisible();
  // Le Studio ancré garde l'autre groupe.
  await expect(page.getByTestId('studio').getByTestId('tab-color')).toBeVisible();
  let box = (await win.boundingBox())!;
  expect(box.y).toBeGreaterThan(250);
  expect(box.y).toBeLessThan(320);

  // Les onglets restent utilisables dans la fenêtre flottante.
  await win.getByTestId('tab-history').click();
  await expect(win.getByTestId('tab-history')).toHaveAttribute('aria-selected', 'true');

  // Redimensionner par le coin inférieur droit.
  const before = box;
  const se = (await page.getByTestId('resize-studio-bottom-se').boundingBox())!;
  await drag(page, [se.x + 4, se.y + 4], [se.x + 84, se.y + 64]);
  box = (await win.boundingBox())!;
  expect(box.width).toBeGreaterThan(before.width + 60);
  expect(box.height).toBeGreaterThan(before.height + 40);

  // La disposition est mémorisée.
  await page.reload();
  await expect(page.getByTestId('float-studio-bottom')).toBeVisible();

  // Ré-ancrer en la ramenant sur le Studio.
  const head = (await page.getByTestId('float-studio-bottom').locator('.studio-tabs').boundingBox())!;
  const studio = (await page.getByTestId('studio').boundingBox())!;
  await drag(page, [head.x + 6, head.y + 10], [studio.x + studio.width / 2, studio.y + 300]);
  await expect(page.getByTestId('float-studio-bottom')).toHaveCount(0);
  await expect(page.getByTestId('studio').getByTestId('tab-layers')).toBeVisible();
});

test('la colonne d’outils devient une palette flottante redimensionnable', async ({ page }) => {
  await drag(page, await center(page, 'toolcol-grip'), [700, 250]);
  const win = page.getByTestId('float-tools');
  await expect(win).toBeVisible();
  // Les outils fonctionnent toujours.
  await page.getByTestId('tool-rect').click();
  await expect(page.getByTestId('tool-rect')).toHaveAttribute('aria-pressed', 'true');

  // Élargir la palette : les outils passent sur plusieurs colonnes.
  const rectY = (await page.getByTestId('tool-rect').boundingBox())!.y;
  const e = (await page.getByTestId('resize-tools-e').boundingBox())!;
  await drag(page, [e.x + 3, e.y + e.height / 2], [e.x + 200, e.y + e.height / 2]);
  expect((await win.boundingBox())!.width).toBeGreaterThan(200);
  expect((await page.getByTestId('tool-rect').boundingBox())!.y).toBeLessThan(rectY);

  // Le bouton d'ancrage la remet à sa place.
  await page.getByTestId('dock-tools').click();
  await expect(win).toHaveCount(0);
  await expect(page.getByTestId('toolcol-grip')).toBeVisible();
});

test('redimensionne le Studio ancré et réinitialise les panneaux', async ({ page }) => {
  const studio = page.getByTestId('studio');
  const w0 = (await studio.boundingBox())!.width;
  const [x, y] = await center(page, 'studio-resize');
  // Studio à droite : glisser son bord gauche vers la gauche l'élargit.
  await drag(page, [x, y], [x - 80, y]);
  expect((await studio.boundingBox())!.width).toBeCloseTo(w0 + 80, -1);

  // Séparateur entre les deux groupes ancrés.
  const top = page.getByTestId('studio-studio-top');
  const h0 = (await top.boundingBox())!.height;
  const [sx, sy] = await center(page, 'studio-split');
  await drag(page, [sx, sy], [sx, sy + 60]);
  expect((await top.boundingBox())!.height).toBeCloseTo(h0 + 60, -1);

  await page.getByRole('button', { name: 'Affichage' }).click();
  await page.getByRole('menuitem', { name: 'Réinitialiser les panneaux' }).click();
  expect((await studio.boundingBox())!.width).toBeCloseTo(w0, 0);
});
