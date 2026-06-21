import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('renders connect button and swap UI', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible();
    await expect(page.getByText(/1 CL8Y =/i)).toBeVisible();
    await expect(page.getByText('You pay')).toBeVisible();
    await expect(page.getByText('You receive')).toBeVisible();
    await expect(page.getByRole('button', { name: 'OTC SWAP' })).toBeVisible();
  });

  test('computes CL8Y output when USDC entered', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('0.00');
    await input.fill('0.70');
    await expect(page.getByText('1.00')).toBeVisible();
  });

  test('OTC SWAP disabled without wallet', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('0.00');
    await input.fill('1');
    await expect(page.getByRole('button', { name: 'OTC SWAP' })).toBeDisabled();
  });
});

test.describe('Admin page', () => {
  test('shows admin or connect prompt', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/Owner Admin|Connect owner wallet/i)).toBeVisible();
  });
});
