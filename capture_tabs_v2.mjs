import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = 'C:\\Users\\kylri\\.gemini\\antigravity\\brain\\0216058e-4d33-4d4d-a2ec-4cd00b81cd57';
const APP_URL = 'http://localhost:5173/inventory'; // Assuming standard Vite port

async function captureScreenshots() {
    const customUserDataDir = path.join(process.cwd(), '.playwright-auth-data');
    const context = await chromium.launchPersistentContext(customUserDataDir, {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        colorScheme: 'light',
    });

    const page = await context.newPage();

    try {
        console.log(`Navigating to ${APP_URL}...`);
        await page.goto(APP_URL, { waitUntil: 'networkidle' });

        // Log in if needed
        try {
            const emailInput = await page.waitForSelector('input[type="email"]', { timeout: 3000 });
            console.log('Login required. Filling credentials...');
            await emailInput.fill('super.admin@procureflow.com');
            await page.fill('input[type="password"]', 'Admin123!');
            await page.click('button[type="submit"]');
            await page.waitForTimeout(4000);
            await page.goto(APP_URL, { waitUntil: 'networkidle' });
        } catch (e) {
            console.log('Already logged in or login not required.');
        }

        console.log('Waiting for dashboard to load...');
        await page.waitForTimeout(3000); // Wait for animations and data

        // Capture Shift & Overlay Tab
        console.log('Clicking Shift & Overlay tab...');
        await page.click('button:has-text("Shift & Overlay")');
        await page.waitForTimeout(2000);
        const shiftOverlayPath = path.join(ARTIFACTS_DIR, `shift_overlay_tab_verification_${Date.now()}.png`);
        await page.screenshot({ path: shiftOverlayPath });
        console.log(`Saved screenshot: ${shiftOverlayPath}`);

        // Capture Investigations Tab
        console.log('Clicking Investigations tab...');
        await page.click('button:has-text("Active Investigations")');
        await page.waitForTimeout(2000);
        const investigationsTabPath = path.join(ARTIFACTS_DIR, `investigations_tab_verification_${Date.now()}.png`);
        await page.screenshot({ path: investigationsTabPath });
        console.log(`Saved screenshot: ${investigationsTabPath}`);

        // Capture Notifications Tab
        console.log('Clicking Notifications & Triggers tab...');
        await page.click('button:has-text("Notifications & Triggers")');
        await page.waitForTimeout(2000);
        const notificationsTabPath = path.join(ARTIFACTS_DIR, `notifications_tab_verification_${Date.now()}.png`);
        await page.screenshot({ path: notificationsTabPath });
        console.log(`Saved screenshot: ${notificationsTabPath}`);

        // Trigger Assign Investigation Modal
        console.log('Opening Assign Investigation Modal...');
        // We can go back to Dashboard and click Assign
        await page.click('button:has-text("Integrity Monitor")');
        await page.waitForTimeout(2000);

        const assignBtn = await page.waitForSelector('button:has-text("Assign")', { timeout: 3000 }).catch(() => null);
        if (assignBtn) {
            await assignBtn.click();
            await page.waitForTimeout(1000); // wait for modal animation
            const assignModalPath = path.join(ARTIFACTS_DIR, `assign_modal_verification_${Date.now()}.png`);
            await page.screenshot({ path: assignModalPath });
            console.log(`Saved screenshot: ${assignModalPath}`);
        } else {
            console.log('Could not find Assign button to open modal');
        }

    } catch (error) {
        console.error('Error during capture:', error);
    } finally {
        await context.close();
    }
}

captureScreenshots();
