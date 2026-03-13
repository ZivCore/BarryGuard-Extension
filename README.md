<div align="center">
  <img src="logo.jpg" alt="BarryGuard Logo" width="200"/>
  
  # 🛡️ BarryGuard
  
  **AI-Powered Solana Token Risk Analyzer**
  
  [![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-orange)](https://chrome.google.com/webstore)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
  
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
  - ✅ Mint Authority (25%)
  - ✅ Freeze Authority (20%)
  - ✅ Liquidity Lock (20%)
  - ✅ Top Holder Concentration (15%)
  - ✅ Token Age (10%)
  - ✅ Holder Count (10%)

### 🎯 Visual Risk Indicators
- **Green Badge** (61-100): Low risk — relatively safe
- **Yellow Badge** (31-60): Medium risk — proceed with caution
- **Red Badge** (0-30): High risk — potential scam

### 💳 Flexible Pricing
| Feature | Free | Rescue Pass (CHF 9) | Pro (CHF 19) |
|---------|------|---------------------|--------------|
| Basic Score | ✅ | ✅ | ✅ |
| Risk Checks | 3 of 6 | All 6 | All 6 + AI |
| Rate Limit | 30/hour | 200/hour | 1000/hour |
| Analysis History | ❌ | ✅ | ✅ |

---

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Supabase
- **Blockchain:** Solana Web3.js, Helius API
- **Payments:** Stripe Checkout & Customer Portal
- **Extension:** WXT Framework, Manifest V3

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- pnpm or npm
- Chrome/Edge browser for extension testing

### Installation

```bash
# Clone the repository
git clone https://github.com/ZivCore/BarryGuard-Extension.git
cd BarryGuard-Extension

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run development server
pnpm dev
```

### Environment Variables

Create a `.env.local` file:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_RESCUE_PASS_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...

# Helius (Solana RPC)
HELIUS_API_KEY=your_helius_key

# Upstash (Rate Limiting)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
```

---

## 🧪 Development

### Build Extension

```bash
# Build for production
pnpm wxt build

# Build and zip for Chrome Web Store
pnpm wxt build --zip
```

### Load Extension in Chrome

1. Open Chrome → Extensions → Developer Mode ON
2. Click "Load unpacked"
3. Select `dist-extension/chrome-mv3/` folder
4. Visit [pump.fun](https://pump.fun) to test

### Run Tests

```bash
# Unit tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

---

## 📁 Project Structure

```
BarryGuard-Extension/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API Routes
│   │   ├── dashboard/    # Protected dashboard pages
│   │   └── pricing/      # Pricing page
│   ├── background/       # Extension background script
│   ├── content-scripts/  # Content script for Pump.fun
│   ├── popup/            # Extension popup UI
│   └── shared/           # Shared utilities
├── lib/                  # Library code
│   ├── auth/             # Authentication
│   ├── blockchain/       # Solana integration
│   ├── scoring/          # Risk scoring engine
│   └── stripe/           # Payment handling
├── supabase/             # Database migrations
└── dist-extension/       # Built extension
```

---

## 🚢 Deployment

### Vercel (Website & API)

```bash
vercel --prod
```

### Chrome Web Store

1. Build extension: `pnpm wxt build --zip`
2. Upload `dist-extension/barryguard-extension.zip` to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Fill in store listing details
4. Submit for review

---

## 🔒 Security

- **DSGVO Compliant** — Data stored in Switzerland (Supabase)
- **No Wallet Data** — We never store your private keys or trading data
- **HTTPS Only** — All API communications encrypted
- **Rate Limiting** — Protection against abuse
- **Input Validation** — All addresses validated (Base58)

---

## 🐻 The Barry Story

> *"In the wild west of memecoins, one bear stands guard."*

BarryGuard was born from the frustration of seeing too many traders get rekt by rug pulls. Our mission is simple: make Solana trading safer through transparency and automated risk analysis.

**Remember:** BarryGuard is a tool, not financial advice. Always DYOR!

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Helius](https://helius.xyz) for Solana RPC infrastructure
- [Supabase](https://supabase.com) for backend services
- [Stripe](https://stripe.com) for payment processing
- The Solana community for endless memecoin inspiration

---

<div align="center">
  
  **Made with 🐻 in Switzerland**
  
  [Website](https://barryguard.com) • [Twitter](https://twitter.com/barryguard) • [Discord](https://discord.gg/barryguard)
  
</div>
