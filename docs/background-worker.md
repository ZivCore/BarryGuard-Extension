# Background Worker

## Overview

The background worker is a Manifest V3 service worker that serves as the central orchestrator. It handles all API communication, manages the local cache, tracks authentication state, and responds to messages from content scripts and the popup.

## Initialization

On startup, the background worker:

1. Initializes the local token cache from Chrome storage
2. Restores cached tier limits
3. Fetches `/api/config` to sync cache TTLs and tier limits from the backend
4. Loads the stored user profile (if any)
5. Sets up a 30-minute interval to re-sync configuration

## Message Protocol

Content scripts and the popup communicate with the background worker via `chrome.runtime.sendMessage`. All messages follow a request/response pattern.

### Token Analysis Messages

| Message Type | Payload | Response | Description |
|-------------|---------|----------|-------------|
| `GET_TOKEN_SCORE` | `{ address }` | `{ success, data: TokenScore }` | Fetch score (cache → server → fresh) |
| `ANALYZE_TOKEN_LIST` | `{ addresses }` | `{ success, data: { scores } }` | Batch analysis (paid tiers) |
| `REFRESH_TOKEN_SCORE` | `{ address, chain }` | `TokenScore` | Force re-analysis (auth required) |
| `GET_TOKEN_METADATA` | `{ address }` | `{ name, symbol, imageUrl }` | Scrape metadata from page |
| `OPEN_POPUP_FOR_TOKEN` | `SelectedToken` | — | Open popup with token |

### Authentication Messages

| Message Type | Payload | Response |
|-------------|---------|----------|
| `LOGIN` | `{ email, password }` | `UserProfile` or error |
| `REGISTER` | `{ email, password }` | `UserProfile` or error |
| `SEND_MAGIC_LINK` | `{ email }` | `{ success }` |
| `OAUTH_LOGIN` | `"google"` | Opens OAuth flow |
| `LOGOUT` | — | — |
| `GET_USER_TIER` | — | `UserProfile` |

### Watchlist Messages

| Message Type | Payload | Response |
|-------------|---------|----------|
| `GET_WATCHLIST_STATUS` | `{ address }` | `WatchlistStatus` |
| `ADD_TO_WATCHLIST` | `{ address }` | `WatchlistStatus` |
| `REMOVE_FROM_WATCHLIST` | `{ address }` | `{ success }` |
| `GET_WATCHLIST_ALERTS` | — | `WatchlistAlert[]` |
| `MARK_WATCHLIST_ALERT_READ` | `{ id }` | `{ success }` |

## Cache Strategy

The background worker implements a three-level cache:

### Level 1: Local Extension Cache

- **Storage:** `chrome.storage.local`
- **Max entries:** 1,000 (FIFO eviction)
- **TTL by tier:**
  - Free: 720 minutes (12 hours)
  - Rescue Pass: 60 minutes
  - Pro: 10 minutes
- **Tier-aware:** A cached result from a lower tier is invalidated when the user upgrades (locked checks would be stale)

### Level 2: Server Cache

- `GET /api/token/:address` — returns the most recent fresh cached score from the backend
- Cache miss or stale cache returns 404 and does not trigger backend analysis

### Level 3: Fresh Analysis

- `POST /api/analyze` — triggers a full on-chain analysis
- Only called when both cache levels miss

### Cache Flow

```
GET_TOKEN_SCORE received
  ↓
Check local cache (TTL + tier match)
  ├─ HIT → return immediately
  └─ MISS → call server cache
       ├─ HIT → cache locally, return
       └─ MISS → call fresh analysis
            ├─ SUCCESS → cache locally, return
            └─ ERROR → return error
```

Content-script list fallbacks cap concurrent individual score fetches at 3. Visible temporary backend pressure statuses (`429`, `503`, `504`) are not retried by the content script.

## Authentication

### Session Sync

Authentication state is synced from the BarryGuard website via a dedicated content script (`barryguard-auth.content.ts`) that runs on `barryguard.com`:

1. Content script checks for auth cookies every 10 seconds
2. If cookie found, fetches session data via `POST /api/auth/session` and tags the request with `X-Extension-Version`
3. Sends `WEBSITE_SESSION_DETECTED` to background worker
4. Background stores token in session storage, profile in local storage
5. Every 60 seconds: refreshes session data (includes usage counters)

### Token Storage

| Data | Storage | Lifetime |
|------|---------|----------|
| Access token | `chrome.storage.session` | Cleared on browser restart |
| Refresh token | `chrome.storage.session` | Cleared on browser restart |
| User profile | `chrome.storage.local` | Persistent |

### Resilience

- If token refresh fails, the previous profile is kept (prevents tier loss during transient errors)
- Profile has a "sticky tier" — the last confirmed tier is remembered to avoid downgrade flicker

## Usage Tracking

The background worker tracks hourly analysis usage locally:

- Usage resets every hour
- Free tier has a 10-second cooldown between analyses
- Usage counters are periodically synced with the backend

## Tab Management

- On tab URL change, the background worker pings the content script
- If the content script doesn't respond (dead context from SPA navigation), it re-injects via `chrome.scripting.executeScript()`
- This handles the MV3 limitation where service workers can terminate and content script contexts can be invalidated
