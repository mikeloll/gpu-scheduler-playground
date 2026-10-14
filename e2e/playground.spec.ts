import { expect, test } from '@playwright/test';
import {
  blocks,
  chooseStrategy,
  clearModels,
  deploy,
  node,
  nodesRunning,
  openApp,
  waitingArea,
  waitUntilPlaced,
} from './helpers';

const STARTER = ['chat-medium', 'code-assist', 'embeddings'];

test.describe('on load', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('shows 8 nodes with the starter models already running', async ({ page }) => {
    await expect(page.getByRole('group')).toHaveCount(8);
    for (const name of STARTER) {
      await expect(page.getByRole('listitem', { name })).toContainText('Running');
      await expect(blocks(page, name).first()).toBeVisible();
    }
    await expect(waitingArea(page).locator('.instance')).toHaveCount(0);
  });

  test('starts with an empty event log', async ({ page }) => {
    await expect(page.getByText('Events will show up here.')).toBeVisible();
  });

  test('reset returns to the starting cluster', async ({ page }) => {
    await page.getByRole('listitem', { name: 'chat-medium' }).getByRole('button', { name: 'Delete' }).click();
    await deploy(page, 'vision', 2, 3);
    await node(page, 'node-1').getByRole('button', { name: 'Take down' }).click();
    await page.getByRole('button', { name: 'Reset' }).click();

    for (const name of STARTER) await expect(page.getByRole('listitem', { name })).toBeVisible();
    await expect(page.getByRole('listitem', { name: 'vision' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Bring up' })).toHaveCount(0);
    await expect(page.getByText('Events will show up here.')).toBeVisible();
  });
});

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.titlePath.includes('on load')) return;
  await openApp(page);
  await clearModels(page);
});

test('an emptied cluster has all 64 GPUs free', async ({ page }) => {
  await expect(page.getByText('0 / 64')).toBeVisible();
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

test('models that are stuck move to the top of the list', async ({ page }) => {
  await deploy(page, 'first', 1, 1);
  await deploy(page, 'second', 8, 1);
  await waitUntilPlaced(page);
  const names = page.locator('.model-list > li .model-name');
  await expect(names).toHaveText(['first', 'second']);

  // Fill every other node, then take down the one running 'second': it has nowhere to go.
  await deploy(page, 'filler', 8, 6);
  await waitUntilPlaced(page);
  const secondNode = (await nodesRunning(page, 'second'))[0];
  await node(page, secondNode).getByRole('button', { name: 'Take down' }).click();

  await expect(page.getByRole('listitem', { name: 'second' })).toContainText("Can't place");
  await expect(names).toHaveText(['second', 'first', 'filler']);

  await node(page, secondNode).getByRole('button', { name: 'Bring up' }).click();
  await waitUntilPlaced(page);
  await expect(names).toHaveText(['first', 'second', 'filler']);
});

test('the event log can be cleared', async ({ page }) => {
  await deploy(page, 'vision', 2, 1);
  await waitUntilPlaced(page); // so no placement event lands after we clear
  const log = page.getByRole('region', { name: 'What happened' });
  await expect(log.getByRole('listitem').first()).toBeVisible();
  await log.getByRole('button', { name: 'Clear' }).click();
  await expect(log.getByText('Events will show up here.')).toBeVisible();

  await node(page, 'node-2').getByRole('button', { name: 'Take down' }).click();
  await expect(log.getByRole('listitem')).toHaveCount(1);
});

test('the model list scrolls instead of pushing the log off screen', async ({ page }) => {
  for (const name of ['a', 'b', 'c', 'd', 'e', 'f']) await deploy(page, `m-${name}`, 1, 1);
  const list = page.locator('.model-list');
  const overflows = await list.evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(overflows).toBe(true);
});
