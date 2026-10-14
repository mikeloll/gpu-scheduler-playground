import { expect, test } from '@playwright/test';

const welcome = (page: import('@playwright/test').Page) =>
  page.getByRole('dialog', { name: 'Welcome to the GPU Scheduler Playground' });

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('explains the app on load and offers both modes', async ({ page }) => {
  await expect(welcome(page)).toBeVisible();
  await expect(welcome(page)).toContainText('binpack');
  await expect(welcome(page).getByRole('button', { name: /Start the guided tour/ })).toBeFocused();
  await expect(welcome(page).getByRole('button', { name: /Explore the playground/ })).toBeVisible();
});

test('starting the tour opens the first frame', async ({ page }) => {
  await welcome(page).getByRole('button', { name: /Start the guided tour/ }).click();
  await expect(welcome(page)).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Guided tour' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('region', { name: 'Guided tour' }).getByRole('heading')).toHaveText('Welcome');
});

test('exploring opens the playground with the starter models', async ({ page }) => {
  await welcome(page).getByRole('button', { name: /Explore the playground/ }).click();
  await expect(welcome(page)).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Playground' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('listitem', { name: 'chat-medium' })).toBeVisible();
});

test('Escape closes it and leaves you in the playground', async ({ page }) => {
  await expect(welcome(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(welcome(page)).toBeHidden();
  await expect(page.getByRole('tab', { name: 'Playground' })).toHaveAttribute('aria-selected', 'true');
});
