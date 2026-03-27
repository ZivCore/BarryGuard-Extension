# Security & Privacy

## Security Model

### No Wallet Access

BarryGuard is a **read-only analysis tool**. It never:
- Requests wallet connections
- Accesses private keys
- Signs transactions
- Interacts with the blockchain directly

All blockchain analysis is performed server-side via the BarryGuard API.

### Minimal Permissions

| Permission | Purpose |
|-----------|---------|
| `storage` | Store cached scores and authentication tokens locally |
| `scripting` | Inject content scripts on supported platforms (MV3 dynamic injection) |
| Host permissions | Access supported DEX platforms for DOM reading and badge injection |

No access to browsing history, bookmarks, downloads, or other sensitive browser data.

### Content Security Policy

The extension enforces a strict CSP:

```
script-src 'self'                   — Only extension scripts, no remote code
style-src 'self'                    — Only extension styles
img-src 'self' data: https://...    — Token logos from known sources only
connect-src 'self' https://...      — API calls to BarryGuard + supported platforms only
```

### DOM Security

- All DOM elements are created via `document.createElement()` — never `innerHTML` with API data
- Badge tooltips use safe text nodes
- URLs are validated against an allowlist before navigation
- HTTPS is enforced for all external URLs (except localhost in development)

### Authentication Token Security

| Data | Storage | Cleared When |
|------|---------|-------------|
| Access token | `chrome.storage.session` | Browser restart |
| Refresh token | `chrome.storage.session` | Browser restart |
| User profile | `chrome.storage.local` | Logout or account deletion |

Session storage (`chrome.storage.session`) is the most secure option for sensitive tokens — it's automatically cleared when the browser session ends. Tokens are only sent to `barryguard.com` over HTTPS.

### URL Validation

Before navigating the user to any external URL:
- HTTPS is required (no HTTP except localhost)
- Stripe URLs are validated against `billing.stripe.com`
- OAuth URLs are validated against known providers (Google, our auth service)
- Explorer URLs are restricted to Solscan

## Privacy

### Data We Collect

When you use the extension:

1. **Token addresses** — Sent to the BarryGuard API for analysis. Only addresses visible on the page you're viewing.
2. **Account data** — If you create an account: email and hashed password (stored securely on our servers).
3. **Usage counters** — Number of analyses per hour (for rate limiting).

### Data We Don't Collect

- No browsing history
- No page content beyond token addresses
- No personal information beyond email (if registered)
- No tracking cookies or analytics
- No data sold to third parties

### Local Storage

The extension stores the following locally in your browser:

| Key | Content | Purpose |
|-----|---------|---------|
| `barryguard_cache` | Token scores (up to 1,000) | Avoid redundant API calls |
| `user_profile` | Tier and usage info | Display account state |
| `auth_token` | Session token | API authentication |
| `selectedToken` | Currently viewed token | Popup display |

All local data can be cleared by removing the extension or via Chrome's extension storage settings.

### Third-Party Communication

The extension only communicates with:
- `barryguard.com` — Our API (scoring, auth, watchlist)
- Supported platforms — DOM reading only, no data sent to these sites

No analytics services, no tracking pixels, no external scripts.

### Privacy Policies

- [English Privacy Policy](privacy-policy-en.md)
- [German Privacy Policy (Datenschutzerklärung)](datenschutzerklaerung.md)

## Responsible Disclosure

If you discover a security vulnerability, please contact us at the email listed in our privacy policy. Do not file a public issue for security vulnerabilities.
