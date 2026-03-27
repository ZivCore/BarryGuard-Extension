import { defineContentScript } from 'wxt/utils/define-content-script';
import { initializeContentScript } from '../content';

function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';

  return message.toLowerCase().includes('extension context invalidated');
}

export default defineContentScript({
  matches: [
    '*://pump.fun/*',
    '*://amm.pump.fun/*',
    '*://swap.pump.fun/*',
    '*://raydium.io/*',
    '*://letsbonk.fun/*',
    '*://bonk.fun/*',
    '*://moonshot.money/*',
    '*://dexscreener.com/*',
    '*://birdeye.so/*',
    '*://bags.fm/*',
    '*://solscan.io/*',
    '*://*.solscan.io/*',
    '*://www.dextools.io/*',
    '*://dextools.io/*',
  ],
  runAt: 'document_end',
  main() {
    try {
      initializeContentScript();
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        return;
      }

      throw error;
    }
  },
});
