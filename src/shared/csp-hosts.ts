/**
 * Single-Source-of-Truth for all API hostnames the extension fetches from.
 *
 * Used to build the CSP `connect-src` directive in wxt.config.ts,
 * keeping it in sync with `host_permissions` automatically (E-H2).
 *
 * Rules:
 * - Only include hosts that the extension service worker or content scripts
 *   actually fetch from (not just platform UI pages).
 * - Do NOT include hosts that are only loaded as page resources (images, scripts)
 *   from the host page itself — those use the page's own CSP, not the extension CSP.
 */
export const CSP_API_HOSTS: string[] = [
  // Platform APIs fetched from the service worker (pair resolution)
  'https://api.dexscreener.com',

  // Pump.fun endpoints — removed from content script (E-H3), now backend-only.
  // Listed here in case future background fetches re-emerge; remove if not needed.
  // 'https://pump.fun',
  // 'https://frontend-api.pump.fun',

  // Platform page origins (needed for cross-origin fetch from content scripts
  // that load within those pages — covered by host_permissions for the page itself,
  // but must also appear in connect-src for service worker fetches).
  'https://pump.fun',
  'https://amm.pump.fun',
  'https://swap.pump.fun',
  'https://raydium.io',
  'https://letsbonk.fun',
  'https://bonk.fun',
  'https://moonshot.money',
  'https://dexscreener.com',
  'https://www.dexscreener.com',
  'https://birdeye.so',
  'https://bags.fm',
  'https://solscan.io',
  'https://www.dextools.io',
  'https://dextools.io',
  'https://dex.coinmarketcap.com',
  'https://www.coingecko.com',
  'https://app.uniswap.org',
  'https://pancakeswap.finance',
  'https://aerodrome.finance',
  'https://etherscan.io',
  'https://bscscan.com',
  'https://basescan.org',
];
