import { test, expect } from '@playwright/test';

test.describe('Admin page (dev mode)', () => {
  test('unlocked for mock owner', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText(/Owner Admin/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Send CL8Y to this address/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update Price' })).toBeVisible();
  });
});
