import { test, expect } from '@playwright/test';

test('OTC SWAP triggers mock transaction when connected', async ({ page }) => {
  await page.goto('/?devconnect=1');
  await page.getByPlaceholder('0.00').fill('0.70');
  await page.getByRole('button', { name: 'OTC SWAP' }).click();
  await expect(page.getByText(/MOCK_TX_HASH/i)).toBeVisible({ timeout: 10000 });
});
