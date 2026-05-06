# Popup UI

## Overview

The popup is the main user interface of the extension. It opens when the user clicks the BarryGuard icon in the browser toolbar or clicks a score badge on a supported platform. It displays the current token analysis and account state.

## Screens

The popup operates as a state machine with 5 screens:

| Screen | Purpose | When Shown |
|--------|---------|------------|
| **loading** | Spinner while initializing | On popup open, briefly |
| **token-detail** | Full analysis display | When a token is selected |
| **no-token** | Prompt to select a token | When no token is in context |
| **manual-entry** | Token address input | User clicks search icon |
| **account** | Tier info, usage, subscription | User clicks account icon |

## Timeout Budget

- Lightweight popup-to-background reads still use the short 2.5-second default timeout.
- Active-tab token detection uses a 250 ms budget. If the content script reports no token, the popup shows `no-token` immediately and ignores stale `selectedToken` storage. If detection times out or the content script is unavailable, the popup falls back to the previous selected-token/loading path.
- Manual popup analysis waits longer than the shared 12-second HTTP client timeout so the popup does not fail before the background worker's BarryGuard API request finishes.

## Token Detail Screen

The main screen shows:

- Current token name, symbol, address, and logo
- Risk score donut and risk label
- Subscores for contract, market structure, and behavior
- Top reasons and the full check list
- Watchlist actions and alerts when available

## Manual Entry

Users can manually enter a Solana token address to analyze any token, even when the current tab has no supported token context. Input validation happens before the request is sent to the background worker.

## Website Login And Account

The extension no longer renders native login/register screens or sends login/register/magic-link API requests. Sign-in and account management happen on the BarryGuard website:

- Login CTA opens `https://www.barryguard.com/login?source=extension`.
- Account/Profile CTA opens `https://www.barryguard.com/dashboard?source=extension`.
- Website session sync still hands authenticated sessions back to the extension via `barryguard-auth.content.ts`.

## Account Screen

The account screen shows:

- Current tier badge
- Hourly usage state
- Subscription management link
- Logout action

The account screen remains available only for already-synced local profile state; entry points that previously opened login now redirect to the website.

## Watchlist

Authenticated users on supported tiers can:

- Save the current token to the watchlist
- See recent watchlist alerts for the selected token
- Open the full BarryGuard check page from the popup
