<div align="center">
  <img src="logo.jpg" alt="BarryGuard Logo" width="200"/>
  
  # 🛡️ BarryGuard
  
  **AI-Powered Solana Token Risk Analyzer**
  
  [![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-orange)](https://chrome.google.com/webstore)
  
  *Protect yourself from rug pulls and scam tokens on Pump.fun*
</div>

---

## 🚀 What is BarryGuard?

BarryGuard is a browser extension that analyzes Solana tokens in real-time and provides instant risk scores. Think of it as an "ad blocker for scams" — a passive protection layer that runs in the background while you trade memecoins on Pump.fun.

### Why "Barry"?

Barry was the most famous bear in Switzerland. Just like Barry protected his territory, BarryGuard protects your wallet from malicious tokens.

---

## ✨ Features

### 🔍 Instant Token Analysis
- **One-click risk scoring** (0-100) for any Solana token
- **6 critical security checks:**
  - ✅ Mint Authority
  - ✅ Freeze Authority  
  - ✅ Liquidity Lock
  - ✅ Top Holder Concentration
  - ✅ Token Age
  - ✅ Holder Count

### 🎯 Visual Risk Indicators
- **Green Badge** (61-100): Low risk
- **Yellow Badge** (31-60): Medium risk
- **Red Badge** (0-30): High risk

### 💳 Flexible Pricing
| Feature | Free | Rescue Pass | Pro |
|---------|------|-------------|-----|
| Basic Score | ✅ | ✅ | ✅ |
| Risk Checks | 3 of 6 | All 6 | All 6 + AI |
| Rate Limit | 30/hour | 200/hour | 1000/hour |

---

## 🚀 Installation

### From Chrome Web Store
*Coming Soon*

### Manual Installation (Developer)

```bash
# Clone the repository
git clone https://github.com/ZivCore/BarryGuard-Extension.git
cd BarryGuard-Extension

# Install dependencies
pnpm install

# Build extension
pnpm wxt build

# Load in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist-extension/chrome-mv3/` folder
```

---

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Development mode with hot reload
pnpm wxt

# Build for production
pnpm wxt build

# Build and zip for Chrome Web Store
pnpm wxt build --zip
```

---

## 🔌 API

The extension communicates with:
```
https://barryguard.com/api
```

**Endpoints:**
- `POST /api/analyze` - Analyze token
- `GET /api/token/{address}` - Get cached score
- `POST /api/auth/*` - Authentication
- `GET /api/user/tier` - Get subscription tier

---

## 📁 Project Structure

```
BarryGuard-Extension/
├── src/
│   ├── background/       # Service worker
│   ├── content-scripts/  # Pump.fun integration
│   ├── popup/            # Extension popup UI
│   ├── platforms/        # Platform adapters
│   └── shared/           # Types, constants, API client
├── assets/               # Static assets
└── dist-extension/       # Built extension
```

---

## 🔒 Privacy

- **No Wallet Data** — We never store your private keys
- **No Tracking** — We don't track your browsing
- **Open Source** — Full transparency

---


---

## 📜 License

Source-available for transparency only.
This code is public to allow inspection and security review.
No permission is granted to use, copy, modify, or redistribute this software.



---

<div align="center">
  
  **Made with 🐻 in Switzerland**
  
  
</div>
