import { expect, test, type Page } from '@playwright/test';
import { node, openApp, waitingArea } from './helpers';

const panel = (page: Page) => page.getByRole('region', { name: 'Guided tour' });
const title = (page: Page) => panel(page).getByRole('heading');

async function next(page: Page, expectTitle: string) {
  await panel(page).getByRole('button', { name: 'Next' }).click();
  await expect(title(page)).toHaveText(expectTitle);
}

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await page.getByRole('tab', { name: 'Guided tour' }).click();
});

test('walks the whole tour, including the three hands-on steps', async ({ page }) => {
  await expect(title(page)).toHaveText('Welcome');
  await expect(panel(page)).toContainText('1 of 15');

  await next(page, 'Models and instances');
  await next(page, 'Who decides where things go?');
  await next(page, 'Efficient packing');
  await next(page, 'Eggs in one basket');
  await next(page, 'Your turn: a node fails');

  // Hands-on: only node-2's button is usable.
  await expect(panel(page).getByRole('button', { name: 'Next' })).toHaveCount(0);
  await expect(node(page, 'node-1').getByRole('button', { name: 'Take down' })).toBeDisabled();
  await node(page, 'node-2').getByRole('button', { name: 'Take down' }).click();
  await expect(title(page)).toHaveText('The damage');

  await next(page, 'Your turn: try spread');
  await page.getByRole('radio', { name: 'Spread' }).click();
  await expect(title(page)).toHaveText('A smaller blast radius', { timeout: 20_000 });

  await next(page, 'The catch');
  await expect(waitingArea(page)).toContainText('chat-large');
  await expect(page.getByText('46', { exact: true })).toBeVisible();

  await next(page, 'Fragmentation');
  await next(page, 'A busier cluster');
  await next(page, 'Your turn: upgrade');
  await page.getByRole('listitem', { name: 'chat-medium' }).getByRole('button', { name: 'Upgrade' }).click();
  await expect(title(page)).toHaveText('Stuck');
  await expect(page.getByRole('listitem', { name: 'chat-medium' })).toContainText('Upgrade stalled');

  await next(page, 'What to remember');
  await expect(panel(page).getByRole('button', { name: 'Next' })).toHaveCount(0);
  await expect(panel(page).getByRole('button', { name: 'Restart tour' })).toBeVisible();
});

test('locks the playground controls during the tour', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Reset' })).toHaveCount(0);
  await expect(page.getByPlaceholder('my-model')).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Spread' })).toBeDisabled();
  for (const row of await page.getByRole('group').all()) {
    await expect(row.getByRole('button')).toBeDisabled();
  }
});

test('marks the control to use with a "Click here" target', async ({ page }) => {
  for (const t of ['Models and instances', 'Who decides where things go?', 'Efficient packing', 'Eggs in one basket', 'Your turn: a node fails']) {
    await next(page, t);
  }
  const target = page.locator('.tour-target');
  await expect(target).toHaveCount(1);
  await expect(target).toHaveText('Take down');
  await expect(node(page, 'node-2').locator('.tour-target')).toHaveCount(1);
});

test('Back returns to the previous frame and its cluster', async ({ page }) => {
  for (const t of ['Models and instances', 'Who decides where things go?', 'Efficient packing', 'Eggs in one basket', 'Your turn: a node fails']) {
    await next(page, t);
  }
  await node(page, 'node-2').getByRole('button', { name: 'Take down' }).click();
  await expect(title(page)).toHaveText('The damage');

  await panel(page).getByRole('button', { name: 'Back' }).click();
  await expect(title(page)).toHaveText('Your turn: a node fails');
  await expect(node(page, 'node-2')).not.toContainText('Down');
});

test('keep playing hands the tour cluster to the playground', async ({ page }) => {
  // Jump to the end by walking it quickly.
  const titles = ['Models and instances', 'Who decides where things go?', 'Efficient packing', 'Eggs in one basket', 'Your turn: a node fails'];
  for (const t of titles) await next(page, t);
  await node(page, 'node-2').getByRole('button', { name: 'Take down' }).click();
  await next(page, 'Your turn: try spread');
  await page.getByRole('radio', { name: 'Spread' }).click();
  await expect(title(page)).toHaveText('A smaller blast radius', { timeout: 20_000 });
  for (const t of ['The catch', 'Fragmentation', 'A busier cluster', 'Your turn: upgrade']) await next(page, t);
  await page.getByRole('listitem', { name: 'chat-medium' }).getByRole('button', { name: 'Upgrade' }).click();
  await next(page, 'What to remember');

  await panel(page).getByRole('button', { name: 'Keep playing with this cluster' }).click();
  await expect(page.getByRole('tab', { name: 'Playground' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('listitem', { name: 'chat-medium' })).toContainText('Upgrade stalled');
  // Playground controls are back.
  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  await expect(node(page, 'node-1').getByRole('button', { name: 'Take down' })).toBeEnabled();
});

test('switching to the playground carries the tour cluster over and keeps your place', async ({ page }) => {
  await next(page, 'Models and instances');
  await next(page, 'Who decides where things go?');
  await expect(panel(page).getByRole('button', { name: 'Next' })).toBeEnabled({ timeout: 20_000 });

  await page.getByRole('tab', { name: 'Playground' }).click();
  await expect(page.getByPlaceholder('my-model')).toBeVisible();
  // The tour's models, not the playground's starter set.
  for (const name of ['chat-medium', 'summarizer', 'reranker']) {
    await expect(page.getByRole('listitem', { name })).toBeVisible();
  }
  await expect(page.getByText('Events will show up here.')).toBeVisible();

  await page.getByRole('tab', { name: 'Guided tour' }).click();
  await expect(title(page)).toHaveText('Who decides where things go?');
});
