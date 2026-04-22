# Popup UI

## Overview

The popup is the main user interface of the extension. It opens when the user clicks the BarryGuard icon in the browser toolbar or clicks a score badge on a supported platform. It displays the current token analysis and account state.

## Screens

The popup operates as a state machine with 7 screens:

| Screen | Purpose | When Shown |
|--------|---------|------------|
| **loading** | Spinner while initializing | On popup open, briefly |
| **token-detail** | Full analysis display | When a token is selected |
| **no-token** | Prompt to select a token | When no token is in context |
| **manual-entry** | Token address input | User clicks search icon |
| **login** | Email/password + magic link + Google | Unauthenticated user |
| **register** | Account creation | User clicks "Sign up" |
| **account** | Tier info, usage, subscription | User clicks account icon |

## Timeout Budget

- Lightweight popup-to-background reads still use the short 2.5-second default timeout.
- Auth flows (`LOGIN`, `REGISTER`, `SEND_MAGIC_LINK`) use a longer timeout budget aligned with the real backend auth path.
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

## Account Screen

The account screen shows:

- Current tier badge
- Hourly usage state
- Subscription management link
- Logout action

Email/password login, registration, and magic-link requests use the auth-specific popup timeout budget instead of the legacy 2.5-second default that only fits lightweight local reads.

## Watchlist

Authenticated users on supported tiers can:

- Save the current token to the watchlist
- See recent watchlist alerts for the selected token
- Open the full BarryGuard check page from the popup
