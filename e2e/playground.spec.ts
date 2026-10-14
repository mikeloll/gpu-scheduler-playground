import { expect, test } from '@playwright/test';
import {
  blocks,
  chooseStrategy,
  deploy,
  node,
  nodesRunning,
  openApp,
  waitingArea,
  waitUntilPlaced,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('starts with an empty 8-node cluster', async ({ page }) => {
  await expect(page.getByRole('group')).toHaveCount(8);
  await expect(page.getByText('0 / 64')).toBeVisible();
  await expect(page.getByText('No models yet.')).toBeVisible();
});

test('deploying a model places every instance with its name and version', async ({ page }) => {
  await deploy(page, 'chat-medium', 4, 2);
  await waitUntilPlaced(page);
  await expect(blocks(page, 'chat-medium')).toHaveCount(2);
  await expect(blocks(page, 'chat-medium').first()).toContainText('v1');
  await expect(page.getByRole('listitem', { name: 'chat-medium' })).toContainText('Running 2/2');
});

test('binpack packs instances onto as few nodes as possible', async ({ page }) => {
  await chooseStrategy(page, 'Binpack');
  await deploy(page, 'embeddings', 1, 4);
  await expect(blocks(page, 'embeddings')).toHaveCount(4);
  await waitUntilPlaced(page);
  expect(await nodesRunning(page, 'embeddings')).toEqual(['node-1']);
});

test('spread puts each instance on a different node', async ({ page }) => {
  await chooseStrategy(page, 'Spread');
  await deploy(page, 'embeddings', 1, 4);
  await expect(blocks(page, 'embeddings')).toHaveCount(4);
  await waitUntilPlaced(page);
  expect(await nodesRunning(page, 'embeddings')).toEqual(['node-1', 'node-2', 'node-3', 'node-4']);
});

test('taking a node down moves its instances to other nodes', async ({ page }) => {
  await deploy(page, 'code-assist', 2, 3);
  await waitUntilPlaced(page);
  await node(page, 'node-1').getByRole('button', { name: 'Take down' }).click();

  await expect(node(page, 'node-1')).toContainText('Down');
  await expect(node(page, 'node-1').locator('.instance')).toHaveCount(0);
  await waitUntilPlaced(page);
  await expect(blocks(page, 'code-assist')).toHaveCount(3);
  await expect(page.getByText('node-1 went down')).toBeVisible();
});

test('instances wait when no node has room, and resume when a node comes back', async ({ page }) => {
  await deploy(page, 'chat-large', 8, 8); // fills the whole cluster
  await waitUntilPlaced(page);
  await node(page, 'node-3').getByRole('button', { name: 'Take down' }).click();

  await expect(waitingArea(page).locator('.instance')).toHaveCount(1);
  await expect(page.getByRole('listitem', { name: 'chat-large' })).toContainText("Can't place");

  await node(page, 'node-3').getByRole('button', { name: 'Bring up' }).click();
  await waitUntilPlaced(page);
  await expect(page.getByRole('listitem', { name: 'chat-large' })).toContainText('Running 8/8');
});

test('an upgrade replaces every instance when there is room', async ({ page }) => {
  await deploy(page, 'vision', 2, 2);
  await waitUntilPlaced(page);
  await page.getByRole('listitem', { name: 'vision' }).getByRole('button', { name: 'Upgrade' }).click();

  await expect(page.getByText('upgrade to v2 complete')).toBeVisible();
  await expect(blocks(page, 'vision')).toHaveCount(2);
  for (const block of await blocks(page, 'vision').all()) await expect(block).toContainText('v2');
});

test('an upgrade stalls on a fragmented cluster despite free GPUs', async ({ page }) => {
  await chooseStrategy(page, 'Spread');
  await deploy(page, 'chat-medium', 4, 1);
  await deploy(page, 'embeddings', 1, 36); // every node ends up 5/8 full
  await expect(page.getByText('40 / 64')).toBeVisible({ timeout: 20_000 });

  const model = page.getByRole('listitem', { name: 'chat-medium' });
  await model.getByRole('button', { name: 'Upgrade' }).click();

  await expect(model).toContainText('Upgrade stalled');
  await expect(model).toContainText('24 GPUs are free across the cluster');
  await expect(model).toContainText('most free on any single node is 3');
  // The old version keeps running while the new one waits.
  await expect(waitingArea(page).locator('.instance')).toContainText('v2');
  await expect(page.getByRole('group').locator('.instance', { hasText: 'chat-medium' })).toContainText('v1');
});

test('switching strategy only affects new placements', async ({ page }) => {
  await chooseStrategy(page, 'Binpack');
  await deploy(page, 'reranker', 1, 3);
  await waitUntilPlaced(page);
  await chooseStrategy(page, 'Spread');
  await expect(page.getByText('affects new placements only')).toBeVisible();
  expect(await nodesRunning(page, 'reranker')).toEqual(['node-1']);
});

test('scaling and deleting a model', async ({ page }) => {
  await deploy(page, 'reranker', 1, 2);
  const model = page.getByRole('listitem', { name: 'reranker' });
  await model.getByRole('button', { name: 'Add one instance' }).click();
  await expect(blocks(page, 'reranker')).toHaveCount(3);
  await model.getByRole('button', { name: 'Remove one instance' }).click();
  await expect(blocks(page, 'reranker')).toHaveCount(2);
  await model.getByRole('button', { name: 'Delete' }).click();
  await expect(blocks(page, 'reranker')).toHaveCount(0);
  await expect(page.getByText('No models yet.')).toBeVisible();
});

test('the event log can be cleared', async ({ page }) => {
  await deploy(page, 'vision', 2, 1);
  const log = page.getByRole('region', { name: 'What happened' });
  await expect(log.getByRole('listitem').first()).toBeVisible();
  await log.getByRole('button', { name: 'Clear' }).click();
  await expect(log.getByText('Events will show up here.')).toBeVisible();

  await node(page, 'node-2').getByRole('button', { name: 'Take down' }).click();
  await expect(log.getByRole('listitem')).toHaveCount(1);
});

test('reset returns to an empty cluster', async ({ page }) => {
  await deploy(page, 'vision', 2, 3);
  await node(page, 'node-1').getByRole('button', { name: 'Take down' }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.getByText('No models yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bring up' })).toHaveCount(0);
});

test('the model list scrolls instead of pushing the log off screen', async ({ page }) => {
  for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) await deploy(page, `m-${name}`, 1, 1);
  const list = page.locator('.model-list');
  const overflows = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(overflows).toBe(true);
});
