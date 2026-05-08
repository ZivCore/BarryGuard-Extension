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
| `GET_TOKEN_SCORE` | `{ address, chain }` | `{ success, data: TokenScore }` | Fetch score (cache → server → fresh); chain-aware since 1.7.10 |
| `ANALYZE_TOKEN_LIST` | `{ addresses }` | `{ success, data: { scores } }` | Batch analysis for signed-in users; anonymous users receive `401 Mass scan requires sign-in` |
| `REFRESH_TOKEN_SCORE` | `{ address, chain }` | `TokenScore` | Force re-analysis (auth required); validates chain-aware |
| `GET_CACHED_SCORE` | `{ address, chain }` | `TokenScore \| null` | Local cache probe; chain-aware since 1.7.10 |
| `GET_TOKEN_METADATA` | `{ address }` | `{ name, symbol, imageUrl }` | Scrape metadata from page |
| `OPEN_POPUP_FOR_TOKEN` | `SelectedToken` | — | Open popup with token; uses `selectedToken.chain` for metadata fallbacks |
| `GET_TAB_TOKEN_DETECTION_STATE` | — | `{ status, address?, chain? }` | Asks the active tab content script whether a token is currently detected; returns one of four status values (see below) |

#### Tab Detection Status Values

`GET_TAB_TOKEN_DETECTION_STATE` classifies the active tab into one of four states. The background checks the tab URL against the canonical 37-platform host list (`PLATFORM_HOST_PATTERNS` from `src/manifest/platform-hosts.ts`) before sending `chrome.tabs.sendMessage`:

| Status | Condition | Popup Action |
|--------|-----------|--------------|
| `has_token` | Supported host, content script responded, token present | Use `address` + `chain` from response |
| `no_token` | Supported host, content script responded, no token on page | Clear `selectedToken` |
| `unsupported` | Active tab URL does not match any supported host pattern | Clear `selectedToken` |
| `unavailable` | Supported host but `chrome.runtime.lastError`, timeout, or no active tab ID | Keep `selectedToken`; trigger re-inject on the active tab |

When the tab is `unavailable`, the background fires the same re-inject path used by `chrome.tabs.onUpdated` (content script dead — re-inject it). This prevents the popup from staying indefinitely in a loading state because the content script never responds again.

**Note:** The legacy constant `SUPPORTED_PLATFORM_HOST_PATTERNS` (Solana-only, 14 hosts) is not used for tab-detection classification. Classification always uses the full `PLATFORM_HOST_PATTERNS` (37 platforms) to avoid marking EVM tabs as `unsupported`.

### Authentication Messages

| Message Type | Payload | Response |
|-------------|---------|----------|
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

The cache probe step classifies the response into one of four outcomes via the `resolveCacheProbeOutcome` helper:
- **cache_hit:** server returned a fresh score (HTTP 200 + data) — return immediately.
- **cache_miss:** server returned 404 (no cached entry or stale) — fall through to step 3 (cooldown/quota) and step 4 (fresh analysis).
- **cache_probe_transient:** server returned 429, 503, or 504 (transient infrastructure error) — fall through to step 3/4, identical to a cache miss. The fresh-analysis path has its own rate-limit and quota enforcement.
- **cache_probe_terminal:** server returned a hard error (401, 403, 500, 400, etc.) — surface the error to the caller via `mapApiFailure`, no fresh analysis.

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

Authentication happens on the BarryGuard website. The popup redirects login/account CTAs to the website, and authentication state is synced back via a dedicated content script (`barryguard-auth.content.ts`) that runs on `barryguard.com`:

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

## Chain-Aware In-Flight Lock

The `_inFlightAddresses` set prevents concurrent duplicate score fetches. Since 1.7.10 the lock key is `chain + ':' + normalizedAddress` instead of the bare address:

- Solana: exact Base58 address (`chain:address` — case-sensitive).
- EVM: lowercase-normalised address (`ethereum:0xabc...`). The same EVM contract address on two different chains (e.g. `ethereum` and `base`) does **not** block each other.

The local cache read in `getTokenScore` also passes the chain so EVM and Solana entries stay in separate cache slots.

## Tab Management

- On tab URL change, the background worker pings the content script
- If the content script doesn't respond (dead context from SPA navigation), it re-injects via `chrome.scripting.executeScript()`
- This handles the MV3 limitation where service workers can terminate and content script contexts can be invalidated
- The same re-inject path is triggered when `GET_TAB_TOKEN_DETECTION_STATE` returns `unavailable` on a supported host, so the popup is not stuck in a permanent loading state
