# API Integration

## Overview

The extension communicates with the BarryGuard API at `https://barryguard.com/api`. All scoring logic runs server-side — the extension only fetches and displays results.

## Base URL

Default: `https://barryguard.com/api`

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

Full analysis of a single Solana token.

```
Request:  { address: string, chain: "solana", mode: "full" }
Response: TokenScore object
```

#### GET /api/token/:address

Retrieve cached analysis from the server.

```
Query:    ?chain=solana
Response: TokenScore object or null
```

#### POST /api/analyze-list

Batch analysis of multiple tokens (Rescue Pass / Pro only).

```
Request:  { addresses: string[], chain: "solana", mode: "light" }
Response: { scores: TokenScore[] }
```

### Authentication

#### POST /api/auth/login
```
Request:  { email, password }
Response: { success, token: { access_token, refresh_token, expires_at }, user, profile }
```

#### POST /api/auth/register
```
Request:  { email, password }
Response: Same as login
```

#### POST /api/auth/magic-link
```
Request:  { email }
Response: { success, message }
```

#### POST /api/auth/refresh
```
Request:  { refresh_token }
Response: { access_token, refresh_token, expires_at }
```

#### POST /api/auth/session
Cookie-based session validation (used by auth sync content script).
```
Response: { valid, user, profile }
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

## Error Handling

| HTTP Status | Error Type | User Message |
|------------|-----------|-------------|
| 400 | `validation` | Custom error from response body |
| 403 | `plan_gate` | Feature requires a higher plan |
| 429 | `rate_limit` or `cooldown` | Hourly limit / cooldown active |
| 502, 503 | `server` | Blockchain data temporarily unavailable |
| Timeout | `network` | Request timed out |
| Network error | `network` | Connection failed |

## TokenScore Response Shape

```typescript
{
  address: string;           // Solana mint address
  chain: "solana";
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
