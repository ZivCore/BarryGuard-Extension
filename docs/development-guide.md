# Development Guide

## Prerequisites

- **Node.js** 18+
- **pnpm** 10+ (`corepack enable && corepack prepare pnpm@latest --activate`)

## Setup

```bash
git clone https://github.com/ZivCore/BarryGuard-Extension.git
cd BarryGuard-Extension
pnpm install
```

### Environment Variables (Optional)

Copy `.env.example` to `.env` and adjust if needed:

```env
BARRYGUARD_API_URL=https://www.barryguard.com/api
BARRYGUARD_APP_URL=https://www.barryguard.com
```

These default to production. Override for local development if you're running the backend locally.

## Development

```bash
pnpm dev                # Start WXT dev server with hot reload
```

This builds the extension to `.output/chrome-mv3/` and watches for changes.

### Loading in Chrome

1. Navigate to `chrome://extensions`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3/` directory
5. Visit a supported platform (e.g., pump.fun) to see badges

### Hot Reload

WXT watches `src/` for changes and rebuilds automatically. Most changes are reflected immediately. Content script changes may require refreshing the target page.

## Build

```bash
pnpm build              # Build + create zip for Chrome Web Store
pnpm build:extension    # Build only (no zip)
```

**Output:**
- `.output/chrome-mv3/` — unpacked extension
- `.output/barryguard-extension-{version}-chrome.zip` — store upload

## Type Checking

```bash
pnpm typecheck          # wxt prepare && tsc --noEmit
```

## Testing

### Unit Tests (Vitest)

```bash
pnpm test               # Run all unit tests
pnpm test -- --watch    # Watch mode
```

Tests are in `tests/` with the same directory structure as `src/`:

```
tests/
├── background/         # Service worker tests
├── content/            # Content script tests
├── platforms/          # Platform adapter tests
├── popup/              # Popup logic tests
└── shared/             # Shared utility tests
```

**Environment:** jsdom (browser-like)

### E2E Tests (Playwright)

```bash
pnpm test:e2e           # Run end-to-end tests
```

Tests are in `e2e/`. Timeout: 90 seconds. Runs headless by default.

## Project Structure

```
src/
├── entrypoints/            # WXT entry points
│   ├── background.ts       # Service worker entry
│   ├── pumpfun.content.ts  # Content script (all platforms)
│   ├── barryguard-auth.content.ts  # Auth sync (barryguard.com)
│   └── popup.html          # Popup HTML + inline styles
│
├── background/             # Background worker logic
│   └── index.ts            # API orchestration, caching, auth
│
├── content/                # Content script logic
│   └── index.ts            # Platform detection, badge coordination
│
├── platforms/              # Platform adapters (one per DEX)
│   ├── platform.interface.ts   # IPlatform interface
│   ├── generic-solana.ts       # Base class for most adapters
│   ├── platform-utils.ts       # Shared badge rendering
│   ├── address-helpers.ts      # Address extraction utilities
│   ├── pumpfun.ts              # Pump.fun (custom)
│   ├── pumpswap.ts             # PumpSwap (custom)
│   ├── raydium.ts              # Raydium (extends generic)
│   ├── dexscreener.ts          # DexScreener (extends generic)
│   ├── birdeye.ts              # Birdeye (extends generic)
│   ├── solscan.ts              # Solscan (extends generic)
│   ├── letsbonk.ts             # LetsBonk (extends generic)
│   ├── moonshot.ts             # Moonshot (extends generic)
│   ├── dextools.ts             # DexTools (extends generic)
│   ├── bags.ts                 # Bags (extends generic)
│   └── generic-solana.ts       # GenericSolanaPlatform base
│
├── popup/                  # Popup UI
│   ├── index.ts            # State management, screen navigation
│   └── render.ts           # DOM rendering, check display
│
├── shared/                 # Shared between all contexts
│   ├── types.ts            # TypeScript types (TokenScore, etc.)
│   ├── api-client.ts       # BarryGuard API client
│   ├── cache.ts            # Local token cache
│   ├── token-score.ts      # Score validation and normalization
│   ├── format.ts           # Formatting utilities
│   ├── runtime-config.ts   # URL configuration
│   ├── website-session.ts  # Session payload types
│   └── pumpfun-metadata.ts # Pump.fun metadata scraping
│
├── config/
│   └── selectors.ts        # CSS selectors per platform
│
├── styles/
│   └── popup.css           # Popup stylesheet
│
└── env.d.ts                # Environment type declarations
```

## Version Bumping

Version is in `package.json`. Always use patch bumps (x.x.+1) unless explicitly instructed otherwise.

After bumping:
```bash
pnpm build              # Produces zip with new version number
```

## Release Process

1. Bump version in `package.json`
2. `pnpm build` → creates `.output/barryguard-extension-{version}-chrome.zip`
3. Upload zip to Chrome Web Store Developer Dashboard
4. Submit for review
5. Commit version bump

## Code Conventions

- **Language:** TypeScript (strict mode)
- **DOM manipulation:** Always use `document.createElement()` — never `innerHTML` with external data
- **URL handling:** All URLs validated via `runtime-config.ts` — HTTPS enforced (except localhost dev)
- **Error handling:** Graceful degradation — API errors show "?" badge, never crash the page
- **Message protocol:** All messages go through `chrome.runtime.sendMessage` — content scripts never call the API directly
