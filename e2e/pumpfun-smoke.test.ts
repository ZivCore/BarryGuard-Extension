import { chromium, expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve('.output', 'chrome-mv3');
const tokenAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

test('loads the built extension popup and renders the selected token state', async () => {
  test.skip(!fs.existsSync(extensionPath), 'Run `npm run build:extension` before the E2E test.');

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barryguard-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  try {
    const serviceWorker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const extensionId = new URL(serviceWorker.url()).host;

    await serviceWorker.evaluate(async ({ address }) => {
      const now = Date.now();

      await chrome.storage.local.set({
        selectedToken: {
          address,
          score: {
            address,
            chain: 'solana',
            score: 84,
            risk: 'low',
            checks: {},
            cached: true,
            token: {
              name: 'Token A',
              symbol: '$TKNA',
            },
          },
          metadata: {
            name: 'Token A',
            symbol: '$TKNA',
          },
        },
        hourly_usage_state: {
          bucketKey: `anonymous:free:${Math.floor(now / 3600000)}`,
          tier: 'free',
          audience: 'anonymous',
          used: 1,
          limit: 10,
          updatedAt: now,
        },
      });
    }, { address: tokenAddress });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator('#token-name')).toHaveText('Token A');
    await expect(page.locator('#score-value')).toHaveText('84');
    await expect(page.locator('#usage-remaining')).toHaveText('9');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
