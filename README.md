<div align="center">
  <img src="logo.jpg" alt="BarryGuard Logo" width="700" />

  # BarryGuard

  **Solana Token Risk Analyzer - Browser Extension**

  [![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-orange)](https://chrome.google.com/webstore)
  [![License](https://img.shields.io/badge/License-Source%20Available-blue)](#license)

  *Real-time scam detection for Solana tokens on Pump.fun*
</div>

---

## Overview

BarryGuard is a Chrome/Brave extension that analyzes Solana tokens in real time and overlays risk scores directly on [Pump.fun](https://pump.fun).

The extension is a thin client:
- no scoring logic runs in the browser
- no direct blockchain calls are made from the extension
- analysis is fetched from the [BarryGuard backend](https://www.barryguard.com)

---

## Features

### Color-Coded Risk Badges

Scores appear directly on Pump.fun token cards:
- Green badge (`61-100`): low risk
- Yellow badge (`31-60`): medium risk
- Red badge (`0-30`): high risk

### Security Checks

The UI is designed to surface these checks when available from the API:
- Mint authority
- Freeze authority
- Liquidity lock
- Top holder concentration
- Token age
- Holder count

### Tier-Based Access

The extension supports tier-based responses from the backend:
- Free
- Rescue Pass
- Pro

### Manual Token Lookup

The popup can analyze any Solana token address directly, even outside Pump.fun.

---

## Installation

### From Chrome Web Store

Coming soon.

### Manual Installation

Prerequisites: Node.js and pnpm

```bash
git clone https://github.com/Rokk001/BarryGuard-Extension.git
cd BarryGuard-Extension
pnpm install
pnpm build
```

Load the extension in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `.output/chrome-mv3`

---

## Development

```bash
# Start WXT dev mode
pnpm dev

# Build extension and zip package
pnpm build

# Build unpacked extension only
pnpm build:extension

# Type-check
pnpm typecheck

# Unit tests
pnpm test

# Browser smoke test
pnpm test:e2e
```

---

## Project Structure

```text
BarryGuard-Extension/
|- src/
|  |- background/        # Service worker logic
|  |- content/           # Content script bootstrap
|  |- entrypoints/       # WXT entrypoints
|  |- platforms/         # Platform adapters
|  |- popup/             # Popup logic
|  |- shared/            # Types, cache, API client
|  `- styles/            # Popup styles
|- public/icons/         # Static extension icons
|- .output/              # Generated build output
|- wxt.config.ts         # WXT configuration
`- package.json
```

---

## API

The extension communicates only with the BarryGuard API.

Default base URL:

```text
https://www.barryguard.com/api
```

You can override it locally with:

```text
WXT_BARRYGUARD_API_URL=https://www.barryguard.com/api
```

Recommended local setup:
- copy `.env.example` to `.env.local`
- set `BARRYGUARD_API_URL` and optional app URLs there

No secrets or API keys are stored in this repository.

---

## Privacy

- No wallet data: private keys are never requested or stored
- No browsing tracking: only token addresses on Pump.fun are processed
- Public source: the repository is kept inspectable for security review

---

## Disclaimer

BarryGuard provides risk indicators based on on-chain data. This is not financial advice. A low risk score does not mean a token is safe. Only invest what you can afford to lose.

---

## License

Source-available for transparency only.
This code is public to allow inspection and security review.
No permission is granted to use, copy, modify, or redistribute this software.

---

<div align="center">

[Website](https://www.barryguard.com) · [Report an Issue](https://github.com/Rokk001/BarryGuard-Extension/issues)

</div>
