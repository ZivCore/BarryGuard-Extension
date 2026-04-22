import { chromium, expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve('.output', 'chrome-mv3');
const tokenAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

test('rehydrates popup token state exclusively through BarryGuard API endpoints', async () => {
  test.skip(!fs.existsSync(extensionPath), 'Run `pnpm build` before the E2E test.');

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barryguard-boundary-e2e-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const seenHosts = new Set<string>();

  await context.route('https://barryguard.com/api/**', async (route) => {
    const url = new URL(route.request().url());
    seenHosts.add(url.host);

    if (url.pathname === '/api/config') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
      return;
    }

    if (url.pathname === '/api/auth/session') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthorized' }),
      });
      return;
    }

    if (url.pathname === `/api/token/solana/${tokenAddress}`) {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not found' }),
      });
      return;
    }

    if (url.pathname === '/api/analyze') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          address: tokenAddress,
          chain: 'solana',
          score: 84,
          risk: 'low',
          checks: {},
          cached: false,
          tokenName: 'Token A',
          tokenSymbol: '$TKNA',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  try {
    const serviceWorker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const extensionId = new URL(serviceWorker.url()).host;

    await serviceWorker.evaluate(async ({ address }) => {
      await chrome.storage.local.set({
        selectedToken: {
          address,
          metadata: {
            name: 'Loading',
            symbol: '$LOAD',
          },
        },
      });
    }, { address: tokenAddress });

    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await expect(page.locator('#score-value')).toHaveText('84');
    await expect(page.locator('#token-name')).toHaveText('Token A');
    await expect(page.locator('#token-symbol')).toHaveText('$TKNA');

    expect([...seenHosts]).toEqual(['barryguard.com']);
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
