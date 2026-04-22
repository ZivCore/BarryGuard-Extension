import { defineConfig } from 'wxt';
import { PLATFORM_HOST_PATTERNS } from './src/manifest/platform-hosts';
import { CSP_API_HOSTS } from './src/shared/csp-hosts';

// Localhost host permissions are only added in dev builds (E-H1).
const DEV_HOST_PERMISSIONS = process.env.NODE_ENV !== 'production'
  ? ['http://localhost/*', 'http://localhost:3000/*']
  : [];

// Localhost barryguard-auth matches are only added in dev builds (E-H1).
// The content script also has a runtime guard for defense-in-depth.
const AUTH_CONTENT_SCRIPT_MATCHES: string[] = [
  '*://barryguard.com/*',
  '*://www.barryguard.com/*',
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost/*', 'http://localhost:3000/*']
    : []),
];

// CSP connect-src built from Single-Source-of-Truth (E-H2): platform hosts + API hosts.
// This keeps the CSP in sync with host_permissions automatically.
const CSP_CONNECT_SRC = [
  'https://barryguard.com',
  'https://www.barryguard.com',
  ...CSP_API_HOSTS,
].join(' ');

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
      '*://barryguard.com/*',
      '*://www.barryguard.com/*',
      ...DEV_HOST_PERMISSIONS,
    ],
    icons: {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png',
    },
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'none'; style-src 'self'; img-src 'self' data: https://pump.fun https://images.pump.fun https://cf-ipfs.com https://ipfs.io https://api.dexscreener.com https://dd.dexscreener.com https://birdeye.so; connect-src ${CSP_CONNECT_SRC}`,
    },
  },
  // barryguard-auth content script matches (dev gets localhost, prod does not)
  // Note: WXT uses the content script's own `matches` field from defineContentScript —
  // the AUTH_CONTENT_SCRIPT_MATCHES variable is kept here for documentation/reference.
  // The actual per-entrypoint matches are defined in barryguard-auth.content.ts.
  // For dev localhost access, the entrypoint's static `matches` array is overridden
  // via the manifest hook below.
  hooks: {
    'build:manifestGenerated'(_wxt, manifest) {
      // In dev builds, inject localhost matches for the barryguard-auth content script.
      if (process.env.NODE_ENV !== 'production') {
        const authScript = manifest.content_scripts?.find((cs) =>
          cs.js?.some((f: string) => f.includes('barryguard-auth')),
        );
        if (authScript) {
          authScript.matches = AUTH_CONTENT_SCRIPT_MATCHES;
        }
      }
    },
  },
  zip: {
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
  vite: () => ({
    envPrefix: ['WXT_', 'VITE_', 'BARRYGUARD_'],
  }),
});
