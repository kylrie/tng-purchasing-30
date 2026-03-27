import { test, expect } from '@playwright/test';

test('take screenshot of assign modal and tabs', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard');

    // Wait a bit for components to render
    await page.waitForTimeout(1000);

    // Click on "Assign" button from the Suspicious Items table
    await page.getByRole('button', { name: /Assign/i }).first().click();

    // Wait for modal to appear
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'C:/Users/kylri/.gemini/antigravity/brain/0216058e-4d33-4d4d-a2ec-4cd00b81cd57/assign_modal_fixed_dark.png', fullPage: true });

    // Close modal
    await page.getByRole('button').filter({ hasText: '' }).nth(1).click();
    await page.waitForTimeout(500);

    // Take screenshot of shift overlay
    await page.getByRole('button', { name: /Shift Overlay/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/kylri/.gemini/antigravity/brain/0216058e-4d33-4d4d-a2ec-4cd00b81cd57/shift_overlay_fixed_dark.png', fullPage: true });

    // Take screenshot of notifications
    await page.getByRole('button', { name: /Notifications/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/kylri/.gemini/antigravity/brain/0216058e-4d33-4d4d-a2ec-4cd00b81cd57/notifications_fixed_dark.png', fullPage: true });

    // Take screenshot of investigations
    await page.getByRole('button', { name: /Investigations/i }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/kylri/.gemini/antigravity/brain/0216058e-4d33-4d4d-a2ec-4cd00b81cd57/investigations_fixed_dark.png', fullPage: true });
});
