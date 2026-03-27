# Platform Adapters

## Overview

Each supported trading platform has a dedicated adapter that handles platform-specific DOM interaction. Adapters implement the `IPlatform` interface and are responsible for detecting tokens on the page, extracting addresses, and rendering score badges in the correct DOM location.

## Supported Platforms

| Platform | ID | Hostname | Type |
|----------|----|----------|------|
| Pump.fun | `pumpfun` | pump.fun | Bonding curve launcher |
| PumpSwap | `pumpswap` | amm.pump.fun, swap.pump.fun | Pump.fun AMM |
| Raydium | `raydium` | raydium.io | DEX / AMM |
| DexScreener | `dexscreener` | dexscreener.com | Token charts |
| Birdeye | `birdeye` | birdeye.so | Token analytics |
| Solscan | `solscan` | solscan.io | Block explorer |
| LetsBonk | `letsbonk` | letsbonk.fun, bonk.fun | Meme coin launcher |
| Moonshot | `moonshot` | moonshot.money | Token launcher |
| DexTools | `dextools` | dextools.io | Trading tools |
| Bags | `bags` | bags.fm | Portfolio tracker |

## IPlatform Interface

Every adapter implements this interface:

```typescript
interface IPlatform {
  readonly id: string;                 // 'pumpfun', 'raydium', etc.
  readonly name: string;               // Display name
  readonly hostPattern: string[];      // MV3 host permission patterns

  matchesLocation(location: Location): boolean;
  extractTokenAddresses(): string[];
  getCurrentPageAddress(): string | null;
  buildSelectedToken(address: string, score: TokenScore): SelectedToken;

  renderScoreBadge(address: string, score: TokenScore): void;
  renderLoadingBadge(address: string): void;
  renderErrorBadge(address: string): void;
  renderLockedBadge(address: string): void;

  observeDOMChanges(callback: () => void): void;
}
```

### Method Responsibilities

| Method | Purpose |
|--------|---------|
| `matchesLocation()` | Returns true if the current page belongs to this platform |
| `extractTokenAddresses()` | Scans the page DOM for all visible Solana token addresses |
| `getCurrentPageAddress()` | Returns the primary token address if on a detail page |
| `buildSelectedToken()` | Constructs a token object with metadata scraped from the page |
| `renderScoreBadge()` | Inserts a colored risk badge next to the token name |
| `renderLoadingBadge()` | Shows a "..." placeholder while fetching the score |
| `renderErrorBadge()` | Shows "?" when the API returns an error |
| `renderLockedBadge()` | Shows a lock icon when rate-limited |
| `observeDOMChanges()` | Sets up a MutationObserver to detect new tokens added to the page |

## GenericSolanaPlatform Base Class

Most adapters extend `GenericSolanaPlatform`, which provides configurable defaults for common patterns:

```typescript
interface GenericSolanaPlatformConfig {
  id: string;
  name: string;
  hostPattern: string[];
  hostnames: string[];

  // Address extraction
  currentAddressPatterns?: RegExp[];        // Extract from URL path
  currentAddressExtractor?: (loc) => string | null;  // Custom extraction logic
  linkAddressPatterns?: RegExp[];           // Extract from link hrefs

  // DOM selectors
  detailTargetSelectors?: string[];         // Where to place badge on detail page
  cardContainerSelectors?: string[];        // Card wrappers on list pages
  nameSelectors?: string[];                 // Token name elements
  symbolSelectors?: string[];               // Token symbol elements
  imageSelectors?: string[];                // Token logo images
  anchorSelectors?: string[];               // Links to scan for addresses

  compactBadge?: boolean;                   // Use "BG 85" instead of "BarryGuard 85"
}
```

Platforms that use this base class: Raydium, DexScreener, Birdeye, LetsBonk, Moonshot, DexTools, Bags, Solscan.

**Pump.fun** and **PumpSwap** have fully custom implementations due to their unique DOM structures.

## Platform Detection Order

Checked in sequence by the content script (first match wins):

1. PumpSwap
2. Pump.fun
3. Raydium
4. LetsBonk
5. Moonshot
6. DexScreener
7. DexTools
8. Birdeye
9. Bags
10. Solscan

## Address Extraction Strategies

Adapters use different strategies depending on the platform:

| Strategy | Example | Used By |
|----------|---------|---------|
| URL path regex | `/coin/[ADDRESS]` | Pump.fun |
| Query parameters | `?outputMint=[ADDRESS]` | Raydium |
| Link href scanning | `<a href="/token/[ADDRESS]">` | DexScreener, Birdeye |
| Data attributes | `[data-token-address]` | Solscan |
| External link extraction | Solscan/Birdeye links in page | DexScreener |
| Pair-to-token resolution | Pair address → API → token address | DexScreener |

## Badge Rendering

### Risk Colors

| Risk Level | Score Range | Color | Badge Text |
|------------|-------------|-------|------------|
| danger | 0–29 | Red (#dc2626) | `BG 12` |
| high | 30–54 | Orange (#ea580c) | `BG 42` |
| caution | 55–74 | Yellow (#d97706) | `BG 65` |
| moderate | 75–89 | Green (#16a34a) | `BG 82` |
| low | 90–100 | Teal (#059669) | `BG 95` |

### Badge States

| State | Appearance | When |
|-------|-----------|------|
| Loading | `...` (gray) | Score being fetched |
| Score | Colored pill with number | Score available |
| Error | `?` (gray) | API error |
| Locked | Lock icon | Rate limit exceeded |

### Tooltip

On hover, the badge shows a tooltip with:
- Risk level icon and label
- Numeric score
- Top 3 risk reasons (truncated)
- Data quality warning (if coverage is limited)
- "Full analysis" link to barryguard.com

## Adding a New Platform

To add support for a new Solana platform:

1. **Create adapter file** in `src/platforms/` (e.g., `newplatform.ts`)
2. **Extend GenericSolanaPlatform** or implement `IPlatform` directly
3. **Configure selectors** for token address extraction and badge placement
4. **Add to detection array** in `src/content/index.ts`
5. **Add host permissions** in `wxt.config.ts`
6. **Add selectors** in `src/config/selectors.ts` (if using configurable selectors)
7. **Update CSP** in `wxt.config.ts` if the platform serves images from a new domain

### Minimal Example

```typescript
import { GenericSolanaPlatform } from './generic-solana';

export class NewPlatformAdapter extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'newplatform',
      name: 'New Platform',
      hostPattern: ['*://newplatform.com/*'],
      hostnames: ['newplatform.com'],
      currentAddressPatterns: [/\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/],
      linkAddressPatterns: [/\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/],
      detailTargetSelectors: ['h1', '[class*="token-name"]'],
    });
  }
}
```
