# BarryGuard Extension

Browser extension for real-time Solana token scam detection on Pump.fun.

## Development

```bash
# Install dependencies
pnpm install

# Build for development
pnpm build

# Load in Chrome:
# 1. Open chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `dist` folder
```

## Features

- Real-time token analysis on Pump.fun
- Risk score badges (0-100)
- Color-coded risk levels (red/yellow/green)
- Lightweight (<100ms performance impact)

## Architecture

```
src/
├── platforms/       # Platform-specific implementations
│   ├── pumpfun.ts   # Pump.fun token detection
│   └── platform.interface.ts
├── content/         # Content scripts
├── background/      # Service worker
├── popup/           # Extension popup UI
└── shared/          # Utilities
```

## API

The extension communicates with `https://barryguard.com/api` for token analysis.

## License

MIT
