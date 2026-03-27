# Popup UI

## Overview

The popup is the main user interface of the extension. It opens when the user clicks the BarryGuard icon in the browser toolbar or clicks a score badge on a supported platform. It displays the full analysis for the selected token and provides account management.

## Screens

The popup operates as a state machine with 7 screens:

| Screen | Purpose | When Shown |
|--------|---------|------------|
| **loading** | Spinner while initializing | On popup open, briefly |
| **token-detail** | Full analysis display | When a token is selected |
| **no-token** | Prompt to select a token | When no token is in context |
| **manual-entry** | Token address input | User clicks search icon |
| **login** | Email/password + magic link + Google | Unauthenticated user |
| **register** | Account creation | User clicks "Sign up" |
| **account** | Tier info, usage, subscription | User clicks account icon |

## Token Detail Screen

The main screen showing the analysis result:

```
┌────────────────────────────────┐
│  [🔍] [⭐] [🔄] [👤]          │  ← Header actions
├────────────────────────────────┤
│  [Logo] Token Name             │
│         TOKEN                  │
│         addr...xyz [📋] [↗]   │  ← Copy + Solscan link
│         View full analysis ↗   │  ← Link to barryguard.com
├────────────────────────────────┤
│       ┌──────────┐             │
│       │  85/100  │             │  ← Score donut
│       │ MODERATE │             │
│       └──────────┘             │
│  BarryGuard cannot guarantee   │
│  safety. Use as risk signal.   │
│  Analyzed 2m ago               │
├────────────────────────────────┤
│  Contract        ████████░ 82  │  ← Subscores
│  Market Struct.  ██████░░░ 71  │
│  Behavior        █████████ 92  │
├────────────────────────────────┤
│  Top Concerns                  │
│  • Creator wallet < 24h old    │
│  • 35% held by top wallet      │
│  • Liquidity unlocked          │
├────────────────────────────────┤
│  All Checks                    │
│  ✅ Mint Authority             │
│  ✅ Freeze Authority           │
│  ⚠️ Top Holder Concentration   │
│  ❌ Creator Wallet Age         │
│  🔒 (locked — upgrade to see)  │
│  ...                           │
└────────────────────────────────┘
```

### Header Actions

| Icon | Action |
|------|--------|
| 🔍 | Open manual token entry |
| ⭐ | Toggle watchlist (authenticated users) |
| 🔄 | Refresh analysis |
| 👤 | Open account screen |

### Score Donut

Color-coded circular chart showing the risk score:

| Risk Level | Score | Color |
|------------|-------|-------|
| DANGER | 0–29 | Red |
| HIGH | 30–54 | Orange |
| CAUTION | 55–74 | Yellow |
| MODERATE | 75–89 | Green |
| LOW | 90–100 | Teal |

### Check Display Order

Checks are shown in a fixed order across all displays:

1. Mint Authority
2. Freeze Authority
3. Liquidity Lock
4. Honeypot Simulation
5. LP Creator Match
6. Top Holder Concentration
7. Token Age
8. Holder Count
9. Developer History
10. Insider Network
11. Bundle Detection
12. Early Dump
13. Sniper Bot Dominance
14. Bonding Curve Status
15. Liquidity Depth
16. Metadata Legitimacy
17. Creator Wallet Age
18. Price Impact
19. Update Authority
20. Creator Retention
21. Liquidity Ratio

### Check Status Icons

| Status | Icon | Meaning |
|--------|------|---------|
| success | ✅ | Check passed — no concern |
| warning | ⚠️ | Elevated risk detected |
| danger | ❌ | Significant risk detected |
| locked | 🔒 | Requires higher tier to view |

## Manual Entry

Users can manually enter a Solana token address (32–44 character base58 string) to analyze any token. Validation rejects invalid formats before sending to the API.

## Account Screen

Shows the user's current plan, usage this hour, and subscription management:

- **Tier badge** (Free / Rescue Pass / Pro)
- **Usage bar** (e.g., "12 / 30 analyses this hour")
- **Manage subscription** link (opens Stripe portal)
- **Logout** button

## Watchlist

Authenticated users (Rescue Pass / Pro) can save tokens to a watchlist. The popup shows:

- Watchlist toggle on the token detail screen
- Watchlist alerts section (score changes for watched tokens)
- Alert badges with unread count
