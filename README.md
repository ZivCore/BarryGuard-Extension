# BarryGuard Extension

Browser extension for real-time Solana token scam detection on Pump.fun.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Load in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist` folder
```

## ✨ Features

- **Real-time Analysis** - Token scores displayed directly on Pump.fun
- **6-Point Risk Check** - Mint Authority, Freeze Authority, Liquidity Lock, Holder Concentration, Token Age, Community Size
- **Color-Coded Scores** - Red (0-30), Yellow (31-60), Green (61-100)
- **Lightweight** - <100ms performance impact
- **Privacy-First** - No data tracking, open source

## 🏗️ Architecture

```
src/
├── platforms/           # Platform-specific implementations
│   ├── pumpfun.ts       # Pump.fun token detection & badge rendering
│   └── platform.interface.ts
├── content/             # Content scripts
│   └── index.ts         # Main content script for Pump.fun
├── background/          # Service worker
│   └── index.ts         # API communication & caching
├── popup/               # Extension popup UI (TODO)
└── shared/              # Utilities (TODO)
    ├── cache.ts
    └── api-client.ts
```

## 🔌 API Integration

The extension communicates with `https://barryguard.com/api`:

- `POST /api/analyze` - Analyze token and get risk score
- `GET /api/token/[address]` - Retrieve cached analysis

## 🎨 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| Pump.fun | ✅ Ready | Full support, badges on token cards |
| More coming soon | 🚧 | Multi-platform architecture ready |

## 🔒 Permissions

- `activeTab` - Access current tab when clicked
- `storage` - Cache token scores locally
- `host_permissions` - Pump.fun and BarryGuard API only

## 🧪 Testing

```bash
# Run tests
pnpm test

# Manual testing
1. Load extension in Chrome
2. Visit https://pump.fun
3. Look for score badges on token cards
```

## 📦 Build

```bash
# Development build
pnpm build

# Production build (minified)
pnpm build:prod
```

## 🤝 Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

MIT - Open source, free to use and modify

## 🔗 Links

- **Website:** https://barryguard.com
- **Main Repo:** https://github.com/Rokk001/BarryGuard
- **Extension Repo:** https://github.com/Rokk001/BarryGuard-Extension
- **Chrome Web Store:** Coming soon

---

Made with ❤️ by the BarryGuard Team 🐕
