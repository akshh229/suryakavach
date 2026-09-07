import { test, expect } from '@playwright/test';

test.describe('SURYAKAVACH Operator Console', () => {
  test('loads the app with all nav links visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('SURYAKAVACH')).toBeVisible();
    for (const item of ['Monitor', 'Replay', 'Catalogue', 'Alerts', 'Methodology']) {
      await expect(page.getByRole('link', { name: item })).toBeVisible();
    }
  });

  test('navigate to Catalogue screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Catalogue' }).click();
    await expect(page.getByRole('heading', { name: 'Flare Catalogue' })).toBeVisible();
    await expect(page).toHaveURL(/\/catalogue/);
  });

  test('navigate to Alerts screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Alerts' }).click();
    await expect(page.getByRole('heading', { name: 'Alert Centre' })).toBeVisible();
  });

  test('navigate to Methodology screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Methodology' }).click();
    await expect(page.getByRole('heading', { name: 'Methodology' })).toBeVisible();
  });

  test('deep links: catalogue route loads directly', async ({ page }) => {
    await page.goto('/catalogue');
    await expect(page.getByRole('heading', { name: 'Flare Catalogue' })).toBeVisible();
  });

  test('deep links: catalogue class filter is in the URL', async ({ page }) => {
    await page.goto('/catalogue?class=M');
    await expect(page.getByRole('heading', { name: 'Flare Catalogue' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'M-CLASS' })).toHaveAttribute('aria-current', 'true');
  });

  test('back and forward move between screens', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Catalogue' }).click();
    await page.getByRole('link', { name: 'Alerts' }).click();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Flare Catalogue' })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Alert Centre' })).toBeVisible();
  });

  test('skip-to-content link works', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('ReplayBar is visible on every screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('toolbar', { name: 'Replay controls' })).toBeVisible();
    await page.getByRole('link', { name: 'Catalogue' }).click();
    await expect(page.getByRole('toolbar', { name: 'Replay controls' })).toBeVisible();
  });

  test('export CSV button is present in Catalogue', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Catalogue' }).click();
    await expect(page.getByRole('button', { name: 'Export catalogue as CSV' })).toBeVisible();
  });
});
