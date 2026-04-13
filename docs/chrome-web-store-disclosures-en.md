# Chrome Web Store Disclosures

This document is written against the current BarryGuard extension configuration.

## Sole Purpose

BarryGuard helps users evaluate tokens on supported websites directly in the browser by showing risk signals, token context, and account-based usage information. The extension reads the currently visible token address and public token metadata on supported pages, requests the corresponding risk analysis from the BarryGuard backend, and displays the result in the page UI and in the extension popup. BarryGuard is built as a cross-platform token risk layer for supported websites across multiple chains (Solana, Ethereum, BNB Chain, Base). The current release supports Pump.fun, PumpSwap, Raydium, LetsBonk, Moonshot, Dexscreener, Birdeye, Bags, Solscan, DexTools, CoinMarketCap DEX (dex.coinmarketcap.com), CoinGecko (Solana, ETH, BSC, Base chain pages on www.coingecko.com), Uniswap, PancakeSwap (BSC, ETH, Base on pancakeswap.finance), Aerodrome, Etherscan, BscScan, BaseScan, GoPlus (gopluslabs.io), TokenSniffer (tokensniffer.com), Honeypot.is (honeypot.is), GeckoTerminal (geckoterminal.com), Ave.ai (ave.ai), DexView (dexview.com), SushiSwap (sushi.com), 1inch (app.1inch.io), Matcha (matcha.xyz), CoW Swap (swap.cow.fi), Paraswap (app.paraswap.io), BaseSwap (baseswap.fi), flaunch (flaunch.gg), four.meme (four.meme), GMGN (gmgn.ai), Poocoin (poocoin.app), Virtuals (app.virtuals.io), DeBank (debank.com), and Zerion (app.zerion.io).

## Justification for `activeTab`

Not applicable in the current release.

BarryGuard no longer requests the `activeTab` permission. The extension works through narrowly scoped host permissions for supported websites and uses bundled content scripts on those explicitly supported domains.

## Justification for `storage`

BarryGuard uses `storage` to keep essential local extension state. This includes authentication state, session tokens, the current user profile and plan, cached token analyses, the last selected token, and local hourly usage counters for request limits. Without `storage`, the extension could not keep users signed in, show account and plan information, or provide fast context-aware token analysis.

## Justification for `scripting`

The extension uses `chrome.scripting.executeScript` solely to re-inject its own bundled content script (`content-scripts/pumpfun.js`) after client-side SPA navigations on supported websites (pump.fun, raydium.io, dexscreener.com, etc.).

Modern single-page applications built with Next.js destroy the content script execution context during internal page transitions — without re-injection, the extension cannot display risk analysis badges after navigation. No remote code is loaded or executed.

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
- `https://dex.coinmarketcap.com/*`
- `https://www.coingecko.com/*`
  BarryGuard reads the currently visible token address and public token metadata on these supported Solana pages so it can show token risk scores directly in page context. CoinGecko now also covers Ethereum, BNB Chain, and Base chain pages.
- `*://app.uniswap.org/*`
- `*://pancakeswap.finance/*`
- `*://www.pancakeswap.finance/*`
  PancakeSwap now covers BSC, Ethereum, and Base chain pages in addition to BSC.
- `*://aerodrome.finance/*`
- `*://www.aerodrome.finance/*`
- `*://etherscan.io/*`
- `*://www.etherscan.io/*`
- `*://bscscan.com/*`
- `*://www.bscscan.com/*`
- `*://basescan.org/*`
- `*://www.basescan.org/*`
  BarryGuard reads token addresses from the DOM on these multi-chain platforms to display risk scores.
- `*://gopluslabs.io/*`
- `*://www.gopluslabs.io/*`
  Display token risk score badge on token security analyzer pages.
- `*://tokensniffer.com/*`
- `*://www.tokensniffer.com/*`
  Display token risk score badge on token security analyzer pages.
- `*://honeypot.is/*`
- `*://www.honeypot.is/*`
  Display token risk score badge on token security analyzer pages.
- `*://geckoterminal.com/*`
- `*://www.geckoterminal.com/*`
  Display token risk score badge on token pages.
- `*://ave.ai/*`
- `*://www.ave.ai/*`
  Display token risk score badge on token pages.
- `*://dexview.com/*`
- `*://www.dexview.com/*`
  Display token risk score badge on token pages.
- `*://sushi.com/*`
- `*://www.sushi.com/*`
  Display token risk score badge on token pages.
- `*://app.1inch.io/*`
  Display token risk score badge on token pages.
- `*://matcha.xyz/*`
- `*://www.matcha.xyz/*`
  Display token risk score badge on token pages.
- `*://swap.cow.fi/*`
  Display token risk score badge on token pages.
- `*://app.paraswap.io/*`
- `*://www.paraswap.io/*`
  Display token risk score badge on token pages.
- `*://baseswap.fi/*`
- `*://www.baseswap.fi/*`
  Display token risk score badge on token pages.
- `*://flaunch.gg/*`
- `*://www.flaunch.gg/*`
  Display token risk score badge on token pages.
- `*://four.meme/*`
- `*://www.four.meme/*`
  Display token risk score badge on token pages.
- `*://gmgn.ai/*`
- `*://www.gmgn.ai/*`
  Display token risk score badge on token pages.
- `*://poocoin.app/*`
- `*://www.poocoin.app/*`
  Display token risk score badge on token pages.
- `*://app.virtuals.io/*`
- `*://virtuals.io/*`
- `*://www.virtuals.io/*`
  Display token risk score badge on token pages.
- `*://debank.com/*`
- `*://www.debank.com/*`
  Display token risk score badge on token pages.
- `*://app.zerion.io/*`
- `*://zerion.io/*`
- `*://www.zerion.io/*`
  Display token risk score badge on token pages.
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

BarryGuard processes subscription-related data for paid users, such as plan tier, subscription status, billing period end, payment method, and customer portal links. This includes data related to free trial subscriptions (trial status, trial end date). Paid plans are purchased on the BarryGuard website, not inside the extension itself. If a user chooses crypto checkout on the website, BarryGuard may process wallet addresses, payment references, selected currency (SOL or USDC), payment status, and transaction signatures needed to match and confirm the payment. The extension does not process full credit card numbers, raw payment credentials, seed phrases, or wallet private keys.

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

#### Technical integrity signals (optional product telemetry)

Yes, limited.

When enabled, the extension may send **anonymized technical events** to the BarryGuard backend from the extension service worker — for example, that a badge anchor could not be found on a supported platform, or that no token address was detected on a page where one was expected. These events include a **platform identifier**, an **event type**, and the **extension version**. They do **not** include your browsing history, full page URLs with sensitive query strings, or wallet secrets. BarryGuard uses this information only to operate and improve overlay reliability. Retention on the server side is limited (raw events are deleted after a fixed period; see the published privacy policy).

## Required Policy Confirmations

For the current extension, the following can be confirmed:

- I do not sell or transfer user data to third parties, except for approved use cases.
- User data is not used or transferred for purposes unrelated to the single purpose of the item.
- User data is not used or transferred to determine creditworthiness or for lending purposes.

## Practical Note Before Submission

The current Chrome Web Store submission should reflect that `activeTab` is not requested by this release. The extension declares `storage` and `scripting`; use the justification sections above for the permission rationale form and any reviewer notes.
