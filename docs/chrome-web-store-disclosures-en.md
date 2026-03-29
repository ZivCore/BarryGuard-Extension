# Chrome Web Store Disclosures

This document is written against the current BarryGuard extension configuration.

## Sole Purpose

BarryGuard helps users evaluate Solana tokens on supported websites directly in the browser by showing risk signals, token context, and account-based usage information. The extension reads the currently visible token address and public token metadata on supported pages, requests the corresponding risk analysis from the BarryGuard backend, and displays the result in the page UI and in the extension popup. BarryGuard is built as a cross-platform token risk layer for supported Solana websites. The current release supports Pump.fun, PumpSwap, Raydium, LetsBonk, Moonshot, Dexscreener, Birdeye, Bags, Solscan, and DexTools.

## Justification for `activeTab`

Not applicable in the current release.

BarryGuard no longer requests the `activeTab` permission. The extension works through narrowly scoped host permissions for supported websites and uses bundled content scripts on those explicitly supported domains.

## Justification for `storage`

BarryGuard uses `storage` to keep essential local extension state. This includes authentication state, session tokens, the current user profile and plan, cached token analyses, the last selected token, and local hourly usage counters for request limits. Without `storage`, the extension could not keep users signed in, show account and plan information, or provide fast context-aware token analysis.

## Justification for Host Permissions

BarryGuard requires host permissions for the following domains in the current release:

- `https://pump.fun/*`
- `https://amm.pump.fun/*`
- `https://swap.pump.fun/*`
- `https://raydium.io/*`
- `https://letsbonk.fun/*`
- `https://bonk.fun/*`
- `https://moonshot.money/*`
- `https://dexscreener.com/*`
- `https://birdeye.so/*`
- `https://bags.fm/*`
- `https://solscan.io/*`
- `https://*.solscan.io/*`
- `https://dextools.io/*`
- `https://www.dextools.io/*`
  BarryGuard reads the currently visible token address and public token metadata on these supported Solana pages so it can show token risk scores directly in page context.
- `https://barryguard.com/*`
- `https://www.barryguard.com/*`
  BarryGuard connects to the BarryGuard backend for token risk analysis, session validation, account information, login, and plan-related features.

These host permissions are used only for the core functionality of the extension. If future versions support additional external websites, the host permissions and disclosures will be updated accordingly.

## Is Remote Code Required?

No.

BarryGuard does not download or execute remote code. All executable extension code is bundled locally with the extension package. External network requests are used only for API responses, account functionality, and loading token images. External responses are not executed as code.

## Data Use

The answers below reflect the current extension behavior and should be updated if the product scope changes.

### What user data does the extension collect now or plan to collect in the future?

#### Personally Identifiable Information

Yes.

If a user signs in, BarryGuard processes data such as email address and an internal user identifier so the extension can provide login, session handling, and plan assignment.

#### Health Information

No.

#### Financial and Payment Information

Yes, limited.

BarryGuard processes subscription-related data for paid users, such as plan tier, subscription status, billing period end, and customer portal links. This includes data related to free trial subscriptions (trial status, trial end date). The extension does not process full credit card numbers or raw payment credentials inside the extension itself.

#### Authentication Information

Yes.

BarryGuard processes login credentials during sign-in or registration and stores authentication/session tokens locally so the user session can persist in the extension.

#### Personal Communications

No.

#### Location

No.

BarryGuard does not use GPS or precise location as a product feature.

#### Web History

No.

BarryGuard does not build or store a browsing history of the user's visited websites. It only operates on supported websites when the user is actively using the extension there.

#### User Activity

Yes, limited.

BarryGuard processes user actions that are necessary for the product to work, such as clicking BarryGuard badges, manually entering token addresses, login and logout actions, and usage needed to enforce hourly request limits.

#### Website Content

Yes.

BarryGuard processes public token-related page content on supported websites, such as token addresses, names, symbols, logos, and the visible token page context, so it can identify the token currently being viewed and display the corresponding analysis.

## Required Policy Confirmations

For the current extension, the following can be confirmed:

- I do not sell or transfer user data to third parties, except for approved use cases.
- User data is not used or transferred for purposes unrelated to the single purpose of the item.
- User data is not used or transferred to determine creditworthiness or for lending purposes.

## Practical Note Before Submission

The current Chrome Web Store submission should reflect that `activeTab` is not requested by this release.
