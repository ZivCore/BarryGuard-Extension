import { defineConfig } from 'wxt';
import { PLATFORM_HOST_PATTERNS } from './src/manifest/platform-hosts';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  publicDir: 'public',
  manifestVersion: 3,
  outDir: '.output',
  manifest: {
    name: 'BarryGuard',
    description: 'Solana token risk overlays on Pump.fun, PumpSwap, Raydium & 7 more platforms. 23 on-chain checks. No wallet access.',
    homepage_url: 'https://barryguard.com',
    permissions: ['storage', 'scripting'],
    host_permissions: [
      ...PLATFORM_HOST_PATTERNS,
      '*://api.dexscreener.com/*',
      '*://barryguard.com/*',
      '*://www.barryguard.com/*',
    ],
    icons: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'none'; style-src 'self'; img-src 'self' data: https://pump.fun https://images.pump.fun https://cf-ipfs.com https://ipfs.io https://api.dexscreener.com https://dd.dexscreener.com https://birdeye.so; connect-src https://pump.fun https://amm.pump.fun https://swap.pump.fun https://raydium.io https://letsbonk.fun https://bonk.fun https://moonshot.money https://dexscreener.com https://www.dexscreener.com https://api.dexscreener.com https://birdeye.so https://bags.fm https://solscan.io https://www.dextools.io https://dextools.io https://dex.coinmarketcap.com https://www.coingecko.com https://barryguard.com https://www.barryguard.com",
    },
  },
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
  vite: () => ({
    envPrefix: ['WXT_', 'VITE_', 'BARRYGUARD_'],
  }),
});
