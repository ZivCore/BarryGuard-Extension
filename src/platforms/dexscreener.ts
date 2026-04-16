import { GenericSolanaPlatform } from './generic-solana';
import { dedupeAddresses } from './address-helpers';
import type { SelectedToken, TokenScore } from '../shared/types';

const DEXSCREENER_TOKEN_LINK_SELECTORS = [
  'a[href*="solscan.io/token/"]',
  'a[href*="birdeye.so/token/"]',
  'a[href*="/token/"]',
  '[data-token-address]',
  '[data-pair-base-token]',
  '[data-base-token]',
];

// Pair-page href pattern: /{chain}/{pairId}
//
// DexScreener uses different identifier formats depending on the surface:
// - Some routes use base58-like addresses (32–44 chars)
// - /solana overview frequently uses opaque lowercase ids that include characters like "l" or "0"
//
// We accept a conservative alphanumeric id length so we don't accidentally match category slugs (e.g. /solana/moonit).
const PAIR_HREF_PATTERN = /^\/[a-z0-9]+\/([a-z0-9]{20,80})(?:[/?#]|$)/i;

export class DexScreenerPlatform extends GenericSolanaPlatform {
  readonly chains = ['solana', 'ethereum', 'bsc', 'base'];
  private readonly pairToTokenMap = new Map<string, string>();
  private readonly tokenToRowMap = new Map<string, Element>();
  private resolutionPending = false;
  private scanCallback: (() => void) | undefined;

  constructor() {
    super({
      id: 'dexscreener',
      name: 'Dexscreener',
      hostPattern: ['*://dexscreener.com/*', '*://www.dexscreener.com/*'],
      hostnames: ['dexscreener.com', 'www.dexscreener.com'],
      currentAddressExtractor: () => {
        for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>(
          'a[href*="solscan.io/token/"], a[href*="birdeye.so/token/"]',
        ))) {
          const href = anchor.href;
          const match = href.match(/(?:solscan\.io|birdeye\.so(?:\/[a-z0-9_-]+)?)\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i);
          if (match?.[1]) {
            return match[1];
          }
        }

        return null;
      },
      currentAddressPatterns: [
        /[?&](?:tokenAddress|baseToken|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
      ],
      linkAddressPatterns: [
        /[?&](?:tokenAddress|baseToken|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
      ],
      anchorSelectors: DEXSCREENER_TOKEN_LINK_SELECTORS,
    });
  }

  override observeDOMChanges(callback: () => void): void {
    this.scanCallback = callback;
    super.observeDOMChanges(callback);
  }

  /**
   * Pair detail URLs use `/solana/{pairId}` where `pairId` may be an opaque id (not a mint).
   * After `resolvePairAddresses`, we map that id to `baseToken.address`.
   */
  override getCurrentPageAddress(): string | null {
    const pairId = getPairIdFromPathname(window.location.pathname);
    if (pairId) {
      const mapped = this.pairToTokenMap.get(pairId);
      if (mapped) {
        return mapped;
      }
    }
    return super.getCurrentPageAddress();
  }

  override extractTokenAddresses(): string[] {
    // Detail page: mint from pair-id resolution, explorer links, or `/token/` in URL
    const currentAddress = this.getCurrentPageAddress();
    if (currentAddress) {
      return [currentAddress];
    }

    const pairId = getPairIdFromPathname(window.location.pathname);
    if (pairId) {
      if (!this.pairToTokenMap.has(pairId) && !this.resolutionPending) {
        this.resolvePairAddresses([pairId]).catch((err: unknown) => {
          console.error('[BarryGuard] DexScreener pair resolution failed:', err);
        });
      }
      return [];
    }

    // List page: collect pair addresses from rows (DexScreener sometimes varies the exact class)
    const rows = this.getListRows();
    if (rows.length === 0) return [];

    const pairAddresses: string[] = [];
    for (const row of rows) {
      const href = row.getAttribute('href') ?? '';
      const match = href.match(PAIR_HREF_PATTERN);
      if (match?.[1]) {
        pairAddresses.push(match[1]);
      }
    }

    if (pairAddresses.length === 0) {
      return [];
    }

    // Trigger async resolution for any unresolved pairs
    const unresolved = pairAddresses.filter((p) => !this.pairToTokenMap.has(p));
    if (unresolved.length > 0 && !this.resolutionPending) {
      this.resolvePairAddresses(unresolved).catch((err: unknown) => {
        console.error('[BarryGuard] DexScreener pair resolution failed:', err);
      });
    }

    // Return currently resolved token addresses, updating row cache
    const tokenAddresses: string[] = [];
    for (const pairAddr of pairAddresses) {
      const tokenAddr = this.pairToTokenMap.get(pairAddr);
      if (tokenAddr) {
        tokenAddresses.push(tokenAddr);
        const row = rows.find((r) => (r.getAttribute('href') ?? '').includes(pairAddr));
        if (row) {
          this.tokenToRowMap.set(tokenAddr, row);
        }
      }
    }

    return dedupeAddresses(tokenAddresses);
  }

  override buildSelectedToken(address: string, score: TokenScore): SelectedToken {
    // Scope metadata to <main> so nameSelectors don't match "DEX SCREENER" in the nav h1
    const metadataRoot = this.isCurrentTokenPage(address)
      ? (document.querySelector('main') ?? document)
      : this.findListContext(address) ?? document;

    return {
      address,
      score,
      metadata: this.extractTokenMetadata(metadataRoot),
    };
  }

  protected override getDetailTarget(): Element | null {
    const tokenName = this.getTokenNameFromTitle();
    if (tokenName) {
      const h2s = Array.from(document.querySelectorAll('h2'));
      for (const h2 of h2s) {
        if (h2.closest('[data-barryguard="true"]')) {
          continue;
        }

        const text = h2.textContent?.trim() ?? '';
        if (text.toLowerCase().startsWith(tokenName.toLowerCase())) {
          return h2;
        }
      }
    }

    const mainH2 = document.querySelector('main h2');
    if (mainH2 && !mainH2.closest('[data-barryguard="true"]')) {
      return mainH2;
    }

    return null;
  }

  protected override findListContext(address: string): Element | null {
    // Try cached row map first
    const cachedRow = this.tokenToRowMap.get(address);
    if (cachedRow && document.contains(cachedRow)) {
      return cachedRow;
    }

    // Rebuild from pairToTokenMap
    for (const [pairAddr, tokenAddr] of this.pairToTokenMap.entries()) {
      if (tokenAddr !== address) {
        continue;
      }

      const row = document.querySelector(
        `a.ds-dex-table-row[href*="${pairAddr}"], a[class*="ds-dex-table-row"][href*="${pairAddr}"]`,
      );
      if (row) {
        this.tokenToRowMap.set(address, row);
        return row;
      }
    }

    return null;
  }

  protected override insertBadge(address: string, target: Element, badge: HTMLDivElement): void {
    if (!this.isCurrentTokenPage(address)) {
      // List row: find the token name text and insert the badge inline after it
      const nameEl =
        target.querySelector('[class*="ds-dex-table-row-base-token-name-text"]')
        ?? target.querySelector('[class*="ds-dex-table-row-base-token-name"]')
        ?? target.querySelector('[class*="ds-dex-table-row-base-token-symbol"]')
        ?? target.querySelector('[class*="token-name" i]')
        ?? target.querySelector('[class*="token-symbol" i]')
        ?? target.querySelector('span')
        ?? target;

      badge.setAttribute('data-barryguard-context', `${this.id}-list`);
      badge.style.display = 'inline-flex';
      badge.style.marginLeft = '4px';
      badge.style.marginTop = '0';
      badge.style.verticalAlign = 'middle';
      badge.style.flexShrink = '0';
      nameEl.insertAdjacentElement('afterend', badge);
      return;
    }

    super.insertBadge(address, target, badge);
  }

  detectChainFromUrl(url: string): string | null {
    const chainPatterns: Array<[RegExp, string]> = [
      [/\/solana(?:\/|$)/i, 'solana'],
      [/\/ethereum(?:\/|$)/i, 'ethereum'],
      [/\/bsc(?:\/|$)/i, 'bsc'],
      [/\/base(?:\/|$)/i, 'base'],
    ];

    for (const [pattern, chain] of chainPatterns) {
      if (pattern.test(url)) {
        return chain;
      }
    }

    return 'solana';
  }

  private async resolvePairAddresses(pairAddresses: string[]): Promise<void> {
    // E-M10: DexScreener API fetch delegated to Background service worker via message.
    // Content scripts must not make direct cross-origin API calls (ADR-007).
    this.resolutionPending = true;
    try {
      const chain = this.detectChainFromUrl(window.location.href) ?? 'solana';
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'RESOLVE_DEX_PAIR', payload: { pairs: pairAddresses, chain } },
          (response: { success?: boolean; data?: { results?: Array<{ pairAddress: string; tokenAddress: string }> } } | undefined) => {
            if (chrome.runtime.lastError || !response?.success) {
              resolve();
              return;
            }
            // Background returns both canonical pairAddress and URL-derived ids already mapped.
            for (const entry of response.data?.results ?? []) {
              if (entry.pairAddress && entry.tokenAddress) {
                this.pairToTokenMap.set(entry.pairAddress, entry.tokenAddress);
              }
            }
            resolve();
          },
        );
      });
      this.scanCallback?.();
    } finally {
      this.resolutionPending = false;
    }
  }

  private getTokenNameFromTitle(): string | null {
    const title = document.title;
    if (!title) {
      return null;
    }

    const beforePrice = title.split(' $')[0]?.trim();
    if (beforePrice && beforePrice.length > 0 && beforePrice.length < 60) {
      return beforePrice;
    }

    return null;
  }

  private getListRows(): HTMLAnchorElement[] {
    const primary = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.ds-dex-table-row'));
    if (primary.length > 0) return primary;

    // Fallback: DexScreener sometimes uses derived classes like ds-dex-table-row-top, etc.
    const fallback = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[class*="ds-dex-table-row"]'));
    if (fallback.length > 0) return fallback;

    // Last resort for /solana overview: pick Solana pair links under main that match the pair href pattern.
    const main = document.querySelector('main') ?? document.body;
    const anchors = Array.from(main.querySelectorAll<HTMLAnchorElement>('a[href^="/solana/"]'));
    return anchors.filter((a) => {
      const href = a.getAttribute('href') ?? '';
      return Boolean(href.match(PAIR_HREF_PATTERN));
    });
  }
}

function getPairIdFromPathname(pathname: string): string | null {
  return pathname.match(PAIR_HREF_PATTERN)?.[1] ?? null;
}
