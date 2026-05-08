# API Integration

## Overview

The extension communicates with the BarryGuard API at `https://www.barryguard.com/api`. All scoring logic runs server-side — the extension only fetches and displays results.

## Base URL

Default: `https://www.barryguard.com/api`

Configurable via environment variables (checked in order):
1. `BARRYGUARD_API_URL`
2. `WXT_BARRYGUARD_API_URL`
3. `VITE_BARRYGUARD_API_URL`

## Authentication

Requests include authentication via:
- `Authorization: Bearer <access_token>` header (when logged in)
- `X-Extension-Version: <version>` header (always)
- `credentials: include` (for cookie-based session sync)

## Endpoints

### Token Analysis

#### POST /api/analyze

Analysis of a single token. The extension always sends `mode: 'essential'` and `source: 'content_script'`, which the backend maps to Essential Mode (score cap 80, reduced data fetch).

```
Request:  { address: string, chain: "solana" | "ethereum" | "bsc" | "base", mode: "essential", source: "content_script" }
Response: TokenScore object
```

The `chain` field is mandatory and must match the chain the token lives on. The background worker derives it from `selectedToken.chain` (set by the platform adapter or content script). Sending the wrong chain or omitting chain causes the backend to default to Solana — the root bug that 1.7.10 fixes for EVM tokens.

#### GET /api/token/:address

Retrieve cached analysis from the server. This endpoint is cache-only and does not start a fresh analysis.

```
Query:    ?chain=solana | ethereum | bsc | base
Response: TokenScore object, or 404 cache-miss JSON when no fresh cache entry exists
```

The background worker treats a 404 cache miss as expected and then calls `POST /api/analyze`. Transient errors on the cache probe (HTTP 429, 503, 504) are treated as cache misses and fall through to the fresh-analysis path, exactly like a 404. Hard errors (401, 403, 500, 400) remain terminal and are surfaced to the caller.

#### POST /api/analyze-list

Batch analysis of multiple tokens for signed-in users. Anonymous extension users are blocked locally with `Mass scan requires sign-in`; Free users are not blocked by the extension.

```
Request:  { addresses: string[], chain: "solana", mode: "light" }
Response: { scores: TokenScore[] }
```

### Authentication

The popup does not call login/register/magic-link endpoints directly. Login and registration happen on the BarryGuard website via `https://www.barryguard.com/login?source=extension`; the website session sync content script then passes the authenticated session back to the background worker.

#### POST /api/auth/refresh
```
Request:  { refresh_token }
Response: { access_token, refresh_token, expires_at }
```

#### POST /api/auth/session
Cookie-based session validation (used by auth sync content script).
```
Headers:  X-Extension-Version (sent by the auth-sync content script)
Response: { valid, user, profile, token? }
```

#### POST /api/auth/logout
Requires authentication.

### Account

#### GET /api/user/tier
```
Response: { tier, usage, limits }
```

### Watchlist

#### GET /api/watchlist/:address
Check if token is on the user's watchlist.

#### POST /api/watchlist
```
Request:  { address, chain }
```

#### DELETE /api/watchlist/:address
Remove token from watchlist.

#### GET /api/watchlist/alerts
Fetch watchlist alerts.

#### PATCH /api/watchlist/alerts/:id/read
Mark alert as read.

### Configuration

#### GET /api/config

Public endpoint — returns cache TTLs and tier limits. Called on startup and every 30 minutes.

```json
{
  "cache": {
    "ttlMinutes": { "free": 720, "rescue_pass": 60, "pro": 10 }
  },
  "auth": {
    "tiers": {
      "free": { "analysesPerHour": 30, "cooldownSeconds": 10 },
      "rescue_pass": { "analysesPerHour": 250, "cooldownSeconds": 0 },
      "pro": { "analysesPerHour": 1000, "cooldownSeconds": 0 }
    }
  }
}
```

## Request Configuration

- **Timeout:** 12 seconds (AbortController)
- **Content-Type:** `application/json`
- **Credentials:** `include`
- **Popup budget:** popup auth/manual-analysis flows wait longer than 12 seconds so the popup does not fail before the underlying API request completes

## Error Handling

| HTTP Status | Error Type | User Message |
|------------|-----------|-------------|
| 400 | `validation` | Custom error from response body |
| 403 | `plan_gate` | Feature requires a higher plan |
| 429 | `SUSPICIOUS_BOT` | Request blocked by bot protection |
| 429 | `rate_limit` or `cooldown` | Hourly limit / cooldown active |
| 502, 503 | `server` | Blockchain data temporarily unavailable |
| Timeout | `network` | Request timed out |
| Network error | `network` | Connection failed |

## TokenScore Response Shape

```typescript
{
  address: string;           // Token address (chain-dependent: Solana = Base58 mint, EVM = 0x... hex address)
  chain: "solana" | "ethereum" | "bsc" | "base";
  score: number;             // 0–100
  risk: "danger" | "high" | "caution" | "moderate" | "low";
  subscores?: {
    contract: number;
    marketStructure: number;
    behavior: number;
  };
  checks: Record<string, {
    status: "success" | "warning" | "danger";
    label: string;
    description: string;
    value: unknown;
    locked?: boolean;
  }>;
  reasons?: string[];        // Top 3–5 risk reasons
  confidence?: "high" | "medium" | "low";
  coverageRisk?: "low" | "moderate" | "high" | "severe" | null;
  cached: boolean;
  analyzedAt?: string;       // ISO timestamp
  token?: {
    name?: string;
    symbol?: string;
    imageUrl?: string;
  };
}
```
