import { expect, type Page } from '@playwright/test';

/** Open the app (dismissing the welcome dialog) with the simulation at full speed so tests stay quick. */
export async function openApp(page: Page, start: 'playground' | 'tour' = 'playground') {
  await page.goto('./');
  const welcome = page.getByRole('dialog', { name: 'Welcome to the GPU Scheduler Playground' });
  await welcome
    .getByRole('button', { name: start === 'tour' ? /Start the guided tour/ : /Explore the playground/ })
    .click();
  await expect(welcome).toBeHidden();
  await page.getByRole('slider', { name: 'Simulation speed' }).fill('100');
}

/** Delete the starter models through the UI so a test can begin from an empty cluster. */
export async function clearModels(page: Page) {
  const deleteButtons = page.getByRole('region', { name: 'Models' }).getByRole('button', { name: 'Delete' });
  while ((await deleteButtons.count()) > 0) await deleteButtons.first().click();
  await expect(page.getByText('No models yet.')).toBeVisible();
  await page.getByRole('region', { name: 'What happened' }).getByRole('button', { name: 'Clear' }).click();
}

export async function deploy(page: Page, name: string, gpus: number, instances: number) {
  await page.getByPlaceholder('my-model').fill(name);
  await page.getByLabel('GPUs each').selectOption(String(gpus));
  await page.locator('form.deploy').getByLabel('Instances').fill(String(instances));
  await page.getByRole('button', { name: 'Deploy' }).click();
}

export async function chooseStrategy(page: Page, strategy: 'Binpack' | 'Spread') {
  await page.getByRole('radio', { name: strategy }).click();
}

export const node = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
export const waitingArea = (page: Page) => page.getByRole('region', { name: 'Waiting for a node' });
export const blocks = (page: Page, model: string) => page.locator('.instance', { hasText: model });

/** Wait until every instance has a node to run on. */
export async function waitUntilPlaced(page: Page) {
  await expect(waitingArea(page).locator('.instance')).toHaveCount(0);
}

/** Names of nodes currently running at least one instance of `model`. */
export async function nodesRunning(page: Page, model: string): Promise<string[]> {
  const names: string[] = [];
  for (const row of await page.getByRole('group').all()) {
    if ((await row.locator('.instance', { hasText: model }).count()) > 0) {
      names.push((await row.getAttribute('aria-label'))!);
    }
  }
  return names;
}
