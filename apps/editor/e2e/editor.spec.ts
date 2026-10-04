import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Snapshot = {
  history: string[];
  nodes: {
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    fill: string;
  }[];
};

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const s = (window as unknown as { poulpe: { editor: { getState: () => any } } }).poulpe.editor.getState();
    return {
      history: s.history,
      nodes: s.doc.artboards[0].children.map((n: any) => ({
        type: n.type,
        x: Math.round(n.x),
        y: Math.round(n.y),
        width: Math.round(n.width),
        height: Math.round(n.height),
        rotation: Math.round(n.rotation),
        fill: n.fill?.type ?? '',
      })),
    };
  });
}

async function canvas(page: Page) {
  const box = (await page.getByTestId('canvas').boundingBox())!;
  const at = (x: number, y: number): [number, number] => [box.x + x, box.y + y];
  const drag = async (a: [number, number], b: [number, number]) => {
    await page.mouse.move(...at(...a));
    await page.mouse.down();
    await page.mouse.move(...at(...b), { steps: 8 });
    await page.mouse.up();
  };
  return { at, drag };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Le téléchargement remplace la boîte de dialogue d'enregistrement du navigateur.
  await page.evaluate(
    () => ((window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker = undefined),
  );
  await expect(page.getByTestId('canvas')).toBeVisible();
});

test('interface en français avec les outils à droite', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Fichier' })).toBeVisible();
  const tools = (await page.getByTestId('tool-select').boundingBox())!;
  const canvasBox = (await page.getByTestId('canvas').boundingBox())!;
  expect(tools.x).toBeGreaterThan(canvasBox.x + canvasBox.width);
});

test('dessine des formes, les déplace, les redimensionne et les fait tourner', async ({ page }) => {
  const { drag } = await canvas(page);
  await page.keyboard.press('m');
  await drag([350, 150], [600, 330]);
  let s = await snapshot(page);
  expect(s.nodes).toHaveLength(1);
  expect(s.nodes[0].type).toBe('rect');
  const first = s.nodes[0];

  await page.keyboard.press('v');
  await drag([450, 250], [500, 290]);
  s = await snapshot(page);
  expect(s.nodes[0].x).toBeGreaterThan(first.x);
  expect(s.history.at(-1)).toBe('history.move');

  // Poignée bas droite : on part de la nouvelle position du coin.
  const moved = s.nodes[0];
  await page.getByTestId('tab-transform').click();
  await page.getByTestId('tf-w').fill('400');
  await page.getByTestId('tf-w').press('Enter');
  s = await snapshot(page);
  expect(s.nodes[0].width).toBe(400);
  expect(s.nodes[0].x).toBe(moved.x);

  await page.getByTestId('tf-r').fill('30');
  await page.getByTestId('tf-r').press('Enter');
  s = await snapshot(page);
  expect(s.nodes[0].rotation).toBe(30);

  await page.keyboard.press('Control+z');
  s = await snapshot(page);
  expect(s.nodes[0].rotation).toBe(0);
  await page.keyboard.press('Control+Shift+z');
  s = await snapshot(page);
  expect(s.nodes[0].rotation).toBe(30);
});

test('crée un texte et le modifie', async ({ page }) => {
  const { at } = await canvas(page);
  await page.keyboard.press('t');
  await page.mouse.click(...at(400, 400));
  await expect(page.getByTestId('text-editor')).toBeFocused();
  await page.keyboard.type('Festival des Mers');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('text-editor')).toHaveCount(0);
  const text = await page.evaluate(() => (window as any).poulpe.editor.doc.artboards[0].children[0]);
  expect(text.type).toBe('text');
  expect(text.text).toBe('Festival des Mers');
  expect(text.width).toBeGreaterThan(100);
  const s = await snapshot(page);
  expect(s.history).toEqual(['history.open', 'history.add']);
});

test('applique un dégradé et groupe des objets', async ({ page }) => {
  const { drag } = await canvas(page);
  await page.keyboard.press('e');
  await drag([300, 300], [450, 450]);
  await page.getByTestId('paint-linear').click();
  await page.keyboard.press('s');
  await drag([500, 300], [650, 450]);
  await page.getByTestId('paint-radial').click();
  let s = await snapshot(page);
  expect(s.nodes.map((n) => n.fill)).toEqual(['linear', 'radial']);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+g');
  s = await snapshot(page);
  expect(s.nodes.map((n) => n.type)).toEqual(['group']);
  await expect(page.getByRole('treeitem', { name: /Groupe/ })).toBeVisible();
});

test('exporte en PNG, JPEG, SVG et PDF, puis enregistre et rouvre un .poulpe', async ({ page }, info) => {
  const { drag } = await canvas(page);
  await page.keyboard.press('m');
  await drag([350, 150], [600, 330]);
  for (const kind of ['png', 'jpeg', 'svg', 'pdf'] as const) {
    await page.getByRole('button', { name: 'Exporter', exact: true }).first().click();
    await page.getByTestId(`export-${kind}`).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-go').click(),
    ]);
    const path = info.outputPath(`export.${kind}`);
    await download.saveAs(path);
    const head = readFileSync(path).subarray(0, 8);
    const magic = { png: [0x89, 0x50], jpeg: [0xff, 0xd8], svg: [0x3c, 0x73], pdf: [0x25, 0x50] }[kind];
    expect([...head.subarray(0, 2)]).toEqual(magic);
  }
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Control+s')]);
  const path = info.outputPath('doc.poulpe');
  await download.saveAs(path);
  const before = await snapshot(page);

  // Nouveau document, puis réouverture du fichier enregistré.
  await page.keyboard.press('Control+n');
  await page.getByTestId('new-create').click();
  expect((await snapshot(page)).nodes).toHaveLength(0);
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  await (await chooser).setFiles(path);
  await expect.poll(async () => (await snapshot(page)).nodes).toEqual(before.nodes);
});

test('passe en anglais et déplace la colonne d’outils à gauche', async ({ page }) => {
  await page.getByRole('button', { name: 'Langue' }).click();
  await expect(page.getByRole('button', { name: 'File' })).toBeVisible();
  await page.getByRole('button', { name: 'Tools column' }).click();
  const tools = (await page.getByTestId('tool-select').boundingBox())!;
  const canvasBox = (await page.getByTestId('canvas').boundingBox())!;
  expect(tools.x).toBeLessThan(canvasBox.x);
});
