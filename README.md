<div align="center">
  <img src="logo.jpg" alt="BarryGuard Logo" width="700"/>

  # BarryGuard

  **Solana Token Risk Analyzer — Browser Extension**

  [![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-orange)](https://chrome.google.com/webstore)
  [![License](https://img.shields.io/badge/License-Source%20Available-blue)](#license)

  *Real-time scam detection for Solana tokens on Pump.fun*
</div>

---

## Overview

BarryGuard is a Chrome/Brave extension that analyzes Solana tokens in real-time and overlays risk scores directly on [Pump.fun](https://pump.fun). It checks on-chain data for common scam indicators and displays a color-coded score badge on every token card — without slowing down your browsing.

The extension is a thin client: it contains no scoring logic and makes no direct blockchain calls. All analysis is performed by the [BarryGuard backend](https://barryguard.com).

---

## Features

### Color-Coded Risk Badges
Scores appear directly on token cards on Pump.fun:
- **Green badge** (61–100): Low risk
- **Yellow badge** (31–60): Medium risk
- **Red badge** (0–30): High risk

### 6 On-Chain Security Checks
| Check | Description |
|-------|-------------|
| Mint Authority | Can the creator print more tokens? |
| Freeze Authority | Can the creator freeze wallets? |
| Liquidity Lock | Is liquidity locked or burned? |
| Top Holder Concentration | What % does the largest wallet hold? |
| Token Age | How long has this token existed? |
| Holder Count | How many unique holders? |

### Tier-Based Access
| Feature | Free | Rescue Pass | Pro |
|---------|------|-------------|-----|
| Risk score badge | ✓ | ✓ | ✓ |
| Visible checks | 3 of 6 | All 6 | All 6 |
| Analyses per hour | 30 | 200 | 1,000 |
| Local cache TTL | 5 min | 2 min | 2 min |

### Manual Token Lookup
Enter any Solana token address directly in the popup to analyze tokens outside of Pump.fun.

---

## Installation

### From Chrome Web Store
*Coming soon.*

### Manual Installation (Developer Mode)

**Prerequisites:** Node.js, pnpm

```bash
git clone https://github.com/Rokk001/BarryGuard-Extension.git
cd BarryGuard-Extension
pnpm install
pnpm build
```

Load the extension in Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the root `BarryGuard-Extension/` folder

---

## Development

```bash
# Install dependencies
pnpm install

# Watch mode (TypeScript)
pnpm dev

# Production build
pnpm build

# Run tests
pnpm test
```

---

## Project Structure

```
BarryGuard-Extension/
├── src/
│   ├── background/        # Service worker (API client, cache, auth)
│   ├── content/           # Content script (token detection, badge rendering)
│   ├── platforms/         # Platform adapters (Pump.fun, extensible)
│   │   ├── platform.interface.ts
│   │   └── pumpfun.ts
│   └── shared/            # Types, cache, API client
├── background.js          # Built service worker
├── content-scripts/       # Built content script
├── popup.html             # Extension popup
├── manifest.json          # Manifest V3
└── package.json
```

---

## API

The extension communicates exclusively with:
```
https://barryguard.com/api
```

No secrets or API keys are stored in this repository. The extension uses only the public API URL.

**Endpoints used:**
- `POST /api/analyze` — Analyze a token (cache miss)
- `GET /api/token/{address}` — Fetch cached score
- `POST /api/auth/session` — Validate session
- `GET /api/user/tier` — Get subscription tier

---

## Privacy

- **No wallet data** — Private keys are never requested or stored
- **No browsing tracking** — Only token addresses on pump.fun are processed
- **Open source** — Full transparency through public source code

---

## Disclaimer

> BarryGuard provides risk indicators based on on-chain data. This is not financial advice. A low risk score does not mean a token is safe. Only invest what you can afford to lose. DYOR.

---

## License

Source-available for transparency only.
This code is public to allow inspection and security review.
No permission is granted to use, copy, modify, or redistribute this software.

---

<div align="center">

[Website](https://barryguard.com) · [Report an Issue](https://github.com/Rokk001/BarryGuard-Extension/issues)

</div>
