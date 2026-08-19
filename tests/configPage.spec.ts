import { test, expect } from './fixtures';

test.describe('Configuration Page', () => {
  test('should display plugin status', async ({ appConfigPage, page }) => {
    await expect(page.getByText('Plugin Status')).toBeVisible();
  });

  test('should show plugin enabled status when enabled', async ({ appConfigPage, page }) => {
    // Plugin should be enabled via provisioning
    await expect(page.getByText('Plugin is enabled')).toBeVisible();
  });

  test('should display configuration tabs', async ({ appConfigPage, page }) => {
    // Check all tabs are visible
    await expect(page.getByRole('tab', { name: 'Setup Guide' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Troubleshooting' })).toBeVisible();
  });

  test('should show Setup Guide content by default', async ({ appConfigPage, page }) => {
    await expect(page.getByText('Step 1: Get Grafana Cloud OTLP Credentials')).toBeVisible();
  });

  test('should navigate to Troubleshooting tab', async ({ appConfigPage, page }) => {
    await page.getByRole('tab', { name: 'Troubleshooting' }).click();
    await expect(page.getByText('No Data Appearing')).toBeVisible();
  });

  test('should have OTLP endpoint input field', async ({ appConfigPage, page }) => {
    // Input field with placeholder
    await expect(page.getByPlaceholder('https://otlp-gateway-prod-us-east-0.grafana.net/otlp')).toBeVisible();
  });

  test('should have API Token input field', async ({ appConfigPage, page }) => {
    // Input field with placeholder
    await expect(page.getByPlaceholder('Your base64-encoded token')).toBeVisible();
  });

  test('should display metrics reference in troubleshooting', async ({ appConfigPage, page }) => {
    await page.getByRole('tab', { name: 'Troubleshooting' }).click();
    await expect(page.getByText('Metrics Reference')).toBeVisible();
    // Use first() to handle multiple matches in code editor
    await expect(page.getByText('claude_code_cost_usage_USD_total').first()).toBeVisible();
    await expect(page.getByText('Codex exports a different OpenTelemetry schema.')).toBeVisible();
  });
});

test.describe.serial('Pricing settings', () => {
  const PLUGIN_SETTINGS = '/api/plugins/timurdigital-claudestats-app/settings';

  const readJsonData = async (request: import('@playwright/test').APIRequestContext) => {
    const response = await request.get(PLUGIN_SETTINGS);
    expect(response.ok()).toBeTruthy();
    return (await response.json()).jsonData ?? {};
  };

  test('should expose a Pricing tab showing the bundled table date', async ({ appConfigPage, page }) => {
    await page.getByRole('tab', { name: 'Pricing' }).click();
    await expect(page.getByText('Codex cost is estimated, not measured')).toBeVisible();
    await expect(page.getByText('Bundled price table')).toBeVisible();
    // The as-of date of the shipped snapshot, not the build date.
    await expect(page.getByText(/as of/)).toBeVisible();
  });

  test('should default to refresh-disabled on a fresh install', async ({ appConfigPage, page, request }) => {
    const jsonData = await readJsonData(request);
    expect(jsonData.priceRefreshEnabled).toBeUndefined();

    await page.getByRole('tab', { name: 'Pricing' }).click();
    await expect(page.getByRole('switch')).not.toBeChecked();
  });

  test('should persist the setting across a reload and keep unrelated jsonData', async ({
    appConfigPage,
    page,
    request,
  }) => {
    const before = await readJsonData(request);
    expect(before.teamMembers).toContain('Timur Olzhabayev');

    await page.getByRole('tab', { name: 'Pricing' }).click();
    // Grafana's Switch paints a <label> over the input; the label is what takes the click.
    await page.getByRole('switch').click({ force: true });
    await page.getByRole('button', { name: 'Save pricing settings' }).click();

    // The save handler reloads the page; wait for the write to land server-side.
    await expect
      .poll(async () => (await readJsonData(request)).priceRefreshEnabled, { timeout: 15000 })
      .toBe(true);

    const after = await readJsonData(request);
    expect(after.teamMembers).toBe(before.teamMembers);

    // Persists across a fresh page load, not just in component state.
    await page.reload();
    await page.getByRole('tab', { name: 'Pricing' }).click();
    await expect(page.getByRole('switch')).toBeChecked();

    // Restore, so this spec leaves the instance as it found it.
    const restore = await request.post(PLUGIN_SETTINGS, {
      data: { enabled: true, pinned: true, jsonData: { ...after, priceRefreshEnabled: false } },
    });
    expect(restore.ok()).toBeTruthy();
  });
});
