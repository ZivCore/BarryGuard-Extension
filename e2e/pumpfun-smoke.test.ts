import { chromium, expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve('.output', 'chrome-mv3');
const tokenAddress = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

test('loads the built extension on pump.fun and renders a BarryGuard badge', async () => {
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
    await context.route('https://pump.fun/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <html>
            <body>
              <a href="/coin/${tokenAddress}">
                <div class="group">
                  <span class="name">Token A</span>
                  <span class="symbol">$TKNA</span>
                </div>
              </a>
            </body>
          </html>
        `,
      });
    });

    await context.route(`https://barryguard.com/api/token/${tokenAddress}*`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          address: tokenAddress,
          chain: 'solana',
          score: 84,
          risk: 'low',
          checks: {},
          cached: true,
          token: {
            name: 'Token A',
            symbol: '$TKNA',
          },
        }),
      });
    });

    await context.route('https://barryguard.com/api/analyze', async (route) => {
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
          token: {
            name: 'Token A',
            symbol: '$TKNA',
          },
        }),
      });
    });

    const page = await context.newPage();
    await page.goto('https://pump.fun/');

    const badge = page.locator(`[data-barryguard-badge="${tokenAddress}"]`);
    await expect(badge).toHaveText('84');
  } finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
});
