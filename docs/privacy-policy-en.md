# Privacy Policy for BarryGuard

## 1. Controller

The controller responsible for data processing in connection with the BarryGuard browser extension is:

BarryGuard  
Email: support@barryguard.com  
Website: https://www.barryguard.com

## 2. Scope of This Privacy Policy

This Privacy Policy explains how BarryGuard processes personal data in connection with the BarryGuard browser extension.

BarryGuard is a browser extension for analyzing tokens on supported websites across multiple chains (Solana, Ethereum, BNB Chain, Base). The extension displays risk scores, token metadata, and plan-based features directly in the browser. BarryGuard is designed to operate across supported parts of the Solana ecosystem and other supported blockchains. The current release supports Pump.fun, PumpSwap, Raydium, LetsBonk, Moonshot, Dexscreener, Birdeye, Bags, Solscan, DexTools, CoinMarketCap DEX, CoinGecko (Solana, ETH, BSC, Base chain pages), Uniswap, PancakeSwap (BSC, ETH, Base), Aerodrome, Etherscan, BscScan, BaseScan, GoPlus (gopluslabs.io), TokenSniffer (tokensniffer.com), Honeypot.is (honeypot.is), GeckoTerminal (geckoterminal.com), Ave.ai (ave.ai), DexView (dexview.com), SushiSwap (sushi.com), 1inch (app.1inch.io), Matcha (matcha.xyz), CoW Swap (swap.cow.fi), Paraswap (app.paraswap.io), BaseSwap (baseswap.fi), flaunch (flaunch.gg), four.meme (four.meme), GMGN (gmgn.ai), Poocoin (poocoin.app), Virtuals (app.virtuals.io), DeBank (debank.com), and Zerion (app.zerion.io).

No new categories of personal data are collected as a result of these additional platforms. The same token-context data (token addresses, names, symbols, logos) is processed on these sites for the same product purpose described in section 3c.
All token- and scoring-relevant network requests initiated by the extension are sent to the BarryGuard backend first; the extension no longer calls third-party token-analysis providers directly for pair resolution, metadata hydration, or score refresh.

## 3. What Data Is Processed

Depending on how the extension is used, BarryGuard may process the following categories of data.

### a) Account and Registration Data

If you create a BarryGuard account or sign in, BarryGuard may process:

- email address
- password
- internal user ID
- authentication and session tokens

### b) Plan and Subscription Data

If you use a paid plan, BarryGuard may also process:

- current plan or tier
- subscription status
- end of the current billing period
- customer portal link
- payment method
- for crypto checkout on the BarryGuard website: selected currency, receiving wallet address, payment reference, transaction signature, and payment lifecycle metadata needed to confirm the payment

BarryGuard does not process full credit card information inside the extension. Payment handling takes place outside the extension through the BarryGuard website and the payment provider used there. For crypto checkout, BarryGuard does not access wallet private keys or seed phrases.

### c) Token and Page Context on Supported Websites

To provide the core product functionality, the extension processes data visible on supported websites, including:

- token addresses
- token names
- token symbols
- token logos
- the current page context of a supported token detail page or token list view

In the current release, this applies to the supported Solana and multi-chain sites listed in section 2. The same type of token-context data may be processed there for the same product purpose.

### d) Technical integrity signals (optional)

When this feature is enabled, the extension may send **anonymized technical events** to the BarryGuard servers from the extension service worker — for example, that a badge could not be placed on a supported site, or that no token address was found where the extension expected one. These events may include:

- a **platform identifier** (which supported site type was active)
- an **event type** (what kind of integration issue was detected)
- the **extension version**
- an optional **normalized path template** (not a full URL with sensitive identifiers)

They do **not** include your full browsing history across the web, wallet private keys, or full page URLs designed to track individuals. BarryGuard uses these signals only to operate and improve overlay reliability. Raw events are retained for a **limited time** (see the BarryGuard website privacy policy for the current retention period) and are then deleted.

### e) Usage and Functional Data

BarryGuard may also process:

- token addresses manually entered by the user
- clicks on BarryGuard badges or buttons inside the extension
- locally stored hourly usage counters
- locally cached analysis results

## 4. Purposes of Processing

BarryGuard processes data only for the following purposes:

- providing token risk analysis
- displaying risk scores and token information in the browser
- authentication and session management
- displaying the active user plan and plan-based features
- local caching and performance optimization
- abuse prevention and enforcement of request limits
- detecting and improving overlay reliability when anonymized integrity signals are sent

## 5. Legal Bases

Where the GDPR applies, processing is based in particular on:

- Art. 6(1)(b) GDPR for the performance of a contract or pre-contractual measures, especially for account, login, and subscription features
- Art. 6(1)(f) GDPR for legitimate interests, especially to securely operate the extension, prevent abuse, and maintain stability and performance
- Art. 6(1)(a) GDPR where consent is required

## 6. Recipients of Data

Personal data may be disclosed to the following categories of recipients where necessary:

- the BarryGuard backend and related technical infrastructure
- hosting and server providers
- authentication service providers
- payment providers on the BarryGuard website if you use a paid plan

No further disclosure takes place unless required by law or necessary to perform the contract.

## 7. Local Browser Storage

BarryGuard stores certain data locally in the browser, including:

- authentication tokens
- user profile and current plan
- last selected token
- cached analysis results
- local usage counters for hourly request limits

This local storage is necessary so the extension can respond quickly, preserve session state, and correctly show usage limits and account information.

## 8. Retention Period

Personal data is retained only as long as necessary for the purposes described above or as required by law.

Accounts whose email address has never been confirmed are automatically deleted after 30 days. This applies only to unconfirmed accounts, not to confirmed users.

Locally stored extension data generally remains stored until:

- you sign out
- the data is replaced or updated
- you remove the extension
- you clear browser storage

## 9. No Sale of User Data

BarryGuard does not sell personal data to third parties.

BarryGuard does not use or transfer user data for purposes unrelated to the extension's single purpose.

BarryGuard does not use or transfer user data to determine creditworthiness or for lending purposes.

## 10. Your Rights

Where applicable under data protection law, you may have the following rights:

- right of access
- right to rectification
- right to erasure
- right to restriction of processing
- right to data portability
- right to object
- right to withdraw consent with future effect

To exercise your rights, please contact us using the contact details above.

## 11. Security

BarryGuard implements appropriate technical and organizational measures to protect personal data against loss, misuse, unauthorized access, unauthorized disclosure, or unauthorized alteration.

## 12. Changes to This Privacy Policy

This Privacy Policy may be updated from time to time, especially if extension features, processed data, or legal requirements change.

The latest published version applies.

## 13. Contact

If you have questions about privacy in connection with BarryGuard, please contact:

support@barryguard.com

---

## Note: Anonymous Session Cookie (2026-04-16)

This Extension Privacy Policy is **not affected** by the `bg_anon_session` cookie introduced in the Security Hardening release of 2026-04-16. That cookie is set exclusively by the BarryGuard web application (`barryguard.com`) and applies only to unauthenticated visitors of the website. The browser extension does not set this cookie and does not read it. The extension's own session management is described in the "Authentication Token Security" section of `security-privacy.md`. For web-app cookie details, see the BarryGuard website Privacy Policy at `https://barryguard.com/privacy`.
