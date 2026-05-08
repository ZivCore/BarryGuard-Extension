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
- Active-tab token detection uses a 250 ms budget. The response carries one of four status values (see Tab Detection below). Based on the status, the popup either clears `selectedToken`, keeps it, or stays in a loading/retry state.
- Manual popup analysis waits longer than the shared 12-second HTTP client timeout so the popup does not fail before the background worker's BarryGuard API request finishes.

## Tab Detection Status Values

`GET_TAB_TOKEN_DETECTION_STATE` returns `{ status, address?, chain? }`. The popup uses the `status` field to decide whether `selectedToken` is still valid:

| Status | Meaning | Popup Behaviour |
|--------|---------|-----------------|
| `has_token` | Supported platform, content script responded, token detected | Use returned `address` and `chain`; proceed to score refresh |
| `no_token` | Supported platform, content script responded, no token on this page | Clear `selectedToken`; show no-token screen |
| `unsupported` | Active tab URL does not match any of the 37 supported platform host patterns | Clear `selectedToken`; show no-token screen |
| `unavailable` | Supported platform, but content script did not respond within timeout (or no active tab ID) | Keep existing `selectedToken`; remain in loading/retry state; background triggers re-inject |

The key rule: `selectedToken` is only cleared on an explicit `no_token` or `unsupported`. A transient `unavailable` does not evict the token — the background re-injects the content script on the active tab and `refreshSelectedTokenScore()` continues polling.

**Previous behaviour (before 1.7.10):** Any non-positive response, including a former `unknown` status, cleared `selectedToken` immediately. This caused newly-detected tokens to appear blank when the content script was still initialising.

## Chain-Aware `selectedToken` and Score Refresh

`selectedToken` carries an explicit `chain` field (added in 1.7.10). The popup uses it as follows:

1. `selectedToken.chain` — primary source.
2. `selectedToken.score?.chain` — fallback when the chain field is absent from storage.
3. Controlled Solana default — only on Solana-only host patterns when no chain is determinable.
4. If no chain can be resolved: show a controlled error/retry state without clearing the token.

`refreshSelectedTokenScore()` sends `GET_TOKEN_SCORE` with `{ address, chain }`. Sending address without chain causes a silent Solana default in the background — the root cause that 1.7.10 fixes for EVM and new tokens.

Force-refresh and watchlist status/toggle use the same chain resolution to avoid silent chain mismatches on multi-chain detail pages.

## Score Handoff Debug Log

When a score handoff fails (score fetched but not rendered, or score arrived for the wrong address/chain), the background worker emits a structured `console.warn` tagged `[barry:score-handoff]`. This is an extension-internal debug log only — it is not sent to `POST /api/extension-health` and does not appear in backend telemetry. No PII, no wallet address in plaintext.

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
