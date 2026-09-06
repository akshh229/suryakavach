import { test, expect } from '@playwright/test';

test.describe('SURYAKAVACH Operator Console', () => {
  test('loads the app with all nav tabs visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('SURYAKAVACH')).toBeVisible();
    for (const tab of ['Monitor', 'Replay', 'Catalogue', 'Alerts', 'Detail', 'Methodology']) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
  });

  test('navigate to Catalogue screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Catalogue' }).click();
    await expect(page.getByText('Solar Flare Detection Catalogue')).toBeVisible();
  });

  test('navigate to Alerts screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Alerts' }).click();
    await expect(page.getByRole('heading', { name: 'Alert Centre' })).toBeVisible();
  });

  test('navigate to Detail screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Detail' }).click();
    await expect(page.getByText('Flare Detail')).toBeVisible();
  });

  test('navigate to Methodology screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Methodology' }).click();
    await expect(page.getByRole('heading', { name: 'Methodology' })).toBeVisible();
  });

  test('skip-to-content link works', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('ReplayBar is visible on every screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('REPLAY')).toBeVisible();
    await page.getByRole('button', { name: 'Catalogue' }).click();
    await expect(page.getByText('REPLAY')).toBeVisible();
  });

  test('export CSV button is present in Catalogue', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Catalogue' }).click();
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
  });
});
