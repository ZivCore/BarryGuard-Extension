import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  entrypointsDir: 'entrypoints',
  publicDir: 'public',
  manifestVersion: 3,
  outDir: '.output',
  manifest: {
    name: 'BarryGuard',
    description: 'Real-time Solana token risk analysis overlay for pump.fun',
    permissions: ['storage'],
    host_permissions: ['*://pump.fun/*', '*://barryguard.com/*', '*://www.barryguard.com/*'],
    icons: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://images.pump.fun https://pump.mypinata.cloud https://ipfs.io https://imagedelivery.net; connect-src https://pump.fun https://barryguard.com https://www.barryguard.com",
    },
  },
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
  vite: () => ({
    envPrefix: ['WXT_', 'VITE_', 'BARRYGUARD_'],
  }),
});
