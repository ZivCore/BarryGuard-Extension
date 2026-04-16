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

## Security Hardening (2026-04-16)

Security improvements relevant to the extension runtime. Umsetzungsdetails: `BarryGuard/docs/plans/active/plan-security-audit-fixes-2026-04-16.md`.

### Dev-Build Localhost-Match

Der `barryguard-auth.content.ts` Content-Script ist in Production-Builds nur fuer `*://barryguard.com/*` aktiv. Der zusaetzliche `http://localhost/*` Match-Pattern ist ausschliesslich in Dev-Builds erlaubt (`if (import.meta.env.DEV)`). In einem Production-Bundle ohne DEV-Flag ist kein Localhost-Match vorhanden, sodass lokale HTTP-Dienste keine Auth-Token-Injection via Content-Script-Nachrichten ermoeglichen.

### JWT Issuer-Check

Der Background-Worker prueft beim Lesen gespeicherter Auth-Token, dass der JWT `iss`-Claim mit der erwarteten Supabase-URL uebereinstimmt. Token aus fremden Projekten oder gespooften Quellen werden abgewiesen.

### CSP Single Source of Truth

Alle im Extension-Bundle enthaltenen `connect-src`- und `img-src`-Hosts sind zentral in `src/shared/csp-hosts.ts` definiert. Neue API-Endpunkte oder Logo-Quellen sind ausschliesslich dort einzutragen; `wxt.config.ts` und `manifest.json` beziehen die Werte daraus. Kein doppeltes Pflegen von Hostnamen in mehreren Dateien.

### Hintergrunddienste fuer externe Daten

Pump.fun-Token-Metadata-Anreicherung, DexScreener/DexTools-Pair-Aufloesung und aehnliche externe Datenabrufe laufen ausschliesslich im Background-Worker (Service Worker), nicht in Content-Scripts auf Drittanbieter-Seiten. Content-Scripts senden eine Nachricht an den Background-Worker; der Worker fuehrt den Fetch aus und antwortet mit dem Ergebnis. Diese Trennung verhindert, dass Drittanbieter-Seiten ueber CSP oder CORS den Abruf beeinflussen koennen.

### URL-Aenderungserkennung via MutationObserver

Die Plattform-Adapters nutzen `MutationObserver` fuer passives URL-Change-Detection statt aktiven `setInterval`-Polling. Kein Polling-Loop, der bei langen Seitenaufenthalten Ressourcen verbraucht oder durch Timer-Jitter fehlerhafte Doppel-Requests ausloest.

### Logger-Gate in Production

`console.log`/`console.debug`-Ausgaben in Extension-Code sind durch `if (import.meta.env.DEV)` gegatet. In Production-Builds werden keine Analyse-Details, Token-Adressen oder API-Antworten in die Browser-Konsole geschrieben.

### `allowLocalHttp` in Production hart deaktiviert

Der Wert `allowLocalHttp` ist im Extension-Laufzeit-Config fuer Production-Builds unveraenderlich `false`. Auch wenn der Backend-Config-Endpunkt `allowLocalHttp: true` zurueckgeben wuerde (z. B. Fehlkonfiguration), ignoriert die Extension diesen Wert in Production und erzwingt HTTPS fuer alle externen Verbindungen.

## Responsible Disclosure

If you discover a security vulnerability, please contact us at the email listed in our privacy policy. Do not file a public issue for security vulnerabilities.
