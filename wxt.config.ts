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
    permissions: ['activeTab', 'storage'],
    host_permissions: ['*://pump.fun/*', '*://barryguard.com/*'],
    icons: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src https://barryguard.com",
    },
  },
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
  vite: () => ({
    envPrefix: ['WXT_', 'VITE_', 'BARRYGUARD_'],
  }),
});
