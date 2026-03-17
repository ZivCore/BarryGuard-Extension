import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  publicDir: 'public',
  manifestVersion: 3,
  outDir: '.output',
  manifest: {
    name: 'BarryGuard',
    description: 'Real-time Solana token risk analysis overlay for supported Solana sites',
    homepage_url: 'https://barryguard.com',
    permissions: ['storage'],
    host_permissions: [
      '*://pump.fun/*',
      '*://amm.pump.fun/*',
      '*://swap.pump.fun/*',
      '*://raydium.io/*',
      '*://letsbonk.fun/*',
      '*://bonk.fun/*',
      '*://moonshot.money/*',
      '*://dexscreener.com/*',
      '*://api.dexscreener.com/*',
      '*://birdeye.so/*',
      '*://bags.fm/*',
      '*://solscan.io/*',
      '*://*.solscan.io/*',
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
      extension_pages: "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src https://pump.fun https://amm.pump.fun https://swap.pump.fun https://raydium.io https://letsbonk.fun https://bonk.fun https://moonshot.money https://dexscreener.com https://api.dexscreener.com https://birdeye.so https://bags.fm https://solscan.io https://barryguard.com https://www.barryguard.com",
    },
  },
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
  vite: () => ({
    envPrefix: ['WXT_', 'VITE_', 'BARRYGUARD_'],
  }),
});
