# Bundled Web Fonts — Licenses

These WOFF2 files are bundled with the BarryGuard browser extension and used
by the stripe badge (`src/platforms/badge-font-injector.ts`). Both font families
are open-source and explicitly permit redistribution and embedding.

## Inter Tight

- Files: `inter-tight-700.woff2`, `inter-tight-800.woff2`
- Source: Google Fonts — https://fonts.google.com/specimen/Inter+Tight
- License: **SIL Open Font License 1.1**
- License text: https://openfontlicense.org/open-font-license-official-text/
- Copyright: © Rasmus Andersson (https://rsms.me/)
- Note: Inter Tight is served by Google Fonts as a variable font; the same
  WOFF2 file covers the full weight range (incl. 700 and 800). The two files
  here are intentionally byte-identical.

## JetBrains Mono

- Files: `jetbrains-mono-700.woff2`, `jetbrains-mono-800.woff2`
- Source: Google Fonts — https://fonts.google.com/specimen/JetBrains+Mono
- License: **Apache License 2.0**
- License text: https://www.apache.org/licenses/LICENSE-2.0
- Copyright: © JetBrains s.r.o.
- Note: Variable-font WOFF2; same file covers 700 and 800. Files are
  byte-identical for the same reason as Inter Tight above.

## Subsets

All four files are the **latin** subset slice (`unicode-range: U+0000-00FF, U+0131,
U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD`)
served by Google Fonts. Sufficient for the badge UI (BarryGuard wordmark, verdict
texts, numeric score).

## Retrieval

Files were downloaded directly from Google Fonts CDN (`fonts.gstatic.com`).
Plain WOFF2, no modifications. Each file's integrity can be re-verified by
re-fetching the latin-slice URL from the public CSS at
`https://fonts.googleapis.com/css2?family=Inter+Tight:wght@700;800&family=JetBrains+Mono:wght@700;800&display=swap`.
