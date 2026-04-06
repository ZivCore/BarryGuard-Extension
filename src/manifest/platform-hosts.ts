// Centralized host patterns for:
// - MV3 `host_permissions` (wxt manifest)
// - Content script `matches` (pumpfun.content)
//
// Keep in sync with platform adapters' `hostPattern` arrays.

export const PLATFORM_HOST_PATTERNS = [
  '*://pump.fun/*',
  '*://amm.pump.fun/*',
  '*://swap.pump.fun/*',
  '*://raydium.io/*',
  '*://letsbonk.fun/*',
  '*://bonk.fun/*',
  '*://moonshot.money/*',
  '*://dexscreener.com/*',
  '*://www.dexscreener.com/*',
  '*://birdeye.so/*',
  '*://bags.fm/*',
  '*://solscan.io/*',
  '*://*.solscan.io/*',
  '*://www.dextools.io/*',
  '*://dextools.io/*',
  '*://dex.coinmarketcap.com/*',
  '*://www.coingecko.com/*',
] as const;

