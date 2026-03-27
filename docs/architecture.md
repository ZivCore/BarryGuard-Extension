# Architecture

## Overview

BarryGuard is a Chrome extension (Manifest V3) that analyzes Solana tokens in real time and overlays risk score badges directly onto supported trading platforms. It follows a **thin client architecture** — all scoring logic runs on the BarryGuard backend. The extension only fetches and displays results.

## System Diagram

```
┌───────────────────────────────────────────────┐
│  Supported Platforms                           │
│  (Pump.fun, Raydium, DexScreener, ...)        │
└─────────────────┬─────────────────────────────┘
                  │ DOM scraping (token addresses)
                  ▼
     ┌──────────────────────────┐
     │  Content Script           │
     │  • Platform detection     │
     │  • Token address extract  │
     │  • Badge injection        │
     │  • DOM observation        │
     └────────────┬─────────────┘
                  │ chrome.runtime.sendMessage
                  ▼
     ┌──────────────────────────┐      ┌─────────────────────┐
     │  Background Worker        │◄────►│  BarryGuard API     │
     │  (Service Worker)         │      │  barryguard.com/api │
     │  • API orchestration      │      └─────────────────────┘
     │  • Local cache (1000 max) │
     │  • Auth state management  │
     │  • Usage tracking         │
     └────────────┬─────────────┘
                  │ chrome.runtime.sendMessage
                  ▼
     ┌──────────────────────────┐
     │  Popup UI                 │
     │  • Score display          │
     │  • Manual token lookup    │
     │  • Login / Account        │
     │  • Watchlist              │
     └──────────────────────────┘
```

## Core Components

```
src/
├── background/          Service worker — API calls, caching, auth
├── content/             Content script bootstrap — platform detection, badge coordination
├── entrypoints/         WXT entry points — background.ts, pumpfun.content.ts, popup.html
├── platforms/           Platform adapters — one per supported site
├── popup/               Popup UI — screens, state machine, rendering
├── shared/              Shared code — types, API client, cache, config
├── config/              CSS selectors per platform
└── styles/              Popup stylesheet
```

## Data Flow

### Single Token Analysis

```
1. User visits a supported platform (e.g., pump.fun/coin/So11...)
2. Content script detects platform via hostname matching
3. Platform adapter extracts token address from URL/DOM
4. Content script renders loading badge ("...")
5. Sends GET_TOKEN_SCORE message to background worker
6. Background checks local cache (tier-aware TTL)
7. Cache miss → calls BarryGuard API (GET /token/:address or POST /analyze)
8. API returns TokenScore with score, risk level, checks, reasons
9. Background caches result locally
10. Content script replaces loading badge with colored score badge
11. User clicks badge → popup opens with full analysis details
```

### Batch Analysis (Rescue Pass / Pro)

```
1. Content script extracts all token addresses visible on a list page
2. Sends ANALYZE_TOKEN_LIST message to background
3. Background calls POST /analyze-list with all addresses
4. API returns array of scores
5. Each score is cached individually
6. Content script renders badges next to each token on the page
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Thin client — no scoring logic in extension | Protects proprietary detection logic; allows instant scoring updates without extension releases |
| Tier-aware cache TTLs | Pro users get fresher data (10min vs 12h for free) |
| Platform adapter pattern | Each DEX has unique DOM structure — adapters encapsulate the differences |
| Session storage for auth tokens | Cleared on browser restart — more secure than persistent storage |
| MutationObserver for DOM changes | Handles SPA navigation and dynamic content loading |
| Content script re-injection | MV3 service workers can die; background re-injects on tab URL change |

## Permissions

| Permission | Purpose |
|-----------|---------|
| `storage` | Local cache and auth token storage |
| `scripting` | Dynamic content script injection (MV3 requirement) |
| Host permissions | Access to supported platforms for DOM scraping and badge injection |

No wallet access. No browsing history. No sensitive permissions.
