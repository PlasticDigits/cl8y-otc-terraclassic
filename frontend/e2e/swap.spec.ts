import { test, expect } from '@playwright/test';

test('OTC SWAP triggers mock transaction when connected', async ({ page }) => {
  await page.goto('/?devconnect=1');
  await page.getByPlaceholder('0.00').fill('0.70');
  await page.getByRole('button', { name: 'OTC SWAP' }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Bought .* CL8Y!/i)).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText('Past buys')).toBeVisible();
  await expect(page.getByText(/Bought .* CL8Y/)).toBeVisible();
  await expect(page.getByRole('link', { name: /MOCK_TX/i })).toBeVisible();
});
