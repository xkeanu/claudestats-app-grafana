import { test, expect } from './fixtures';

test.describe('App Navigation', () => {
  test('should load the app and display Overview page', async ({ gotoPage, page }) => {
    await gotoPage();
    // Use breadcrumb which is more specific
    await expect(page.getByTestId('data-testid Coding Tool Stats breadcrumb')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
  });

  test('should navigate to Costs tab', async ({ gotoPage, page }) => {
    await gotoPage();
    await page.getByRole('tab', { name: 'Costs' }).click();
    await expect(page).toHaveURL(/.*\/costs/);
  });

  test('should navigate to Tokens tab', async ({ gotoPage, page }) => {
    await gotoPage();
    await page.getByRole('tab', { name: 'Tokens' }).click();
    await expect(page).toHaveURL(/.*\/tokens/);
    await expect(page.getByText('Total Tokens').first()).toBeVisible();
    await expect(page.getByText('Claude Tokens by Device')).toBeVisible();
  });

  test('should navigate to Tools tab', async ({ gotoPage, page }) => {
    await gotoPage();
    await page.getByRole('tab', { name: 'Tools' }).click();
    await expect(page).toHaveURL(/.*\/tools/);
    await expect(page.getByText('Usage by Tool')).toBeVisible();
  });

  test('should navigate to Codex tab', async ({ gotoPage, page }) => {
    await gotoPage();
    await page.getByRole('tab', { name: 'Codex' }).click();
    await expect(page).toHaveURL(/.*\/codex/);
  });

  test('should navigate to Productivity tab', async ({ gotoPage, page }) => {
    await gotoPage();
    await page.getByRole('tab', { name: 'Productivity' }).click();
    await expect(page).toHaveURL(/.*\/productivity/);
  });

  test('should navigate to Sessions tab', async ({ gotoPage, page }) => {
    await gotoPage();
    await page.getByRole('tab', { name: 'Sessions' }).click();
    await expect(page).toHaveURL(/.*\/sessions/);
    await expect(page.getByText('Sessions / Turns')).toBeVisible();
  });

  test('should show Codex environment panels on Environment tab', async ({ gotoPage, page }) => {
    await gotoPage('/environment');
    await expect(page).toHaveURL(/.*\/environment/);
    await expect(page.getByText('Codex Originator')).toBeVisible();
    await expect(page.getByText('Codex Source')).toBeVisible();
  });

  test('should display time range picker', async ({ gotoPage, page }) => {
    await gotoPage();
    await expect(page.getByTestId('data-testid TimePicker Open Button')).toBeVisible();
  });
});
