import { GenericSolanaPlatform } from './generic-solana';
import { dedupeAddresses } from './address-helpers';
import type { SelectedToken, TokenScore } from '../shared/types';

// DexTools uses pair addresses in URLs, not token addresses.
// Resolution strategy: DOM-based (Solscan/Birdeye links) + DexScreener API fallback.

// DexTools uses "pair-explorer/<pairId>" where pairId can be a base58-like address
// OR an opaque alphanumeric id originating from DexScreener (may include "0" / "l").
const PAIR_EXPLORER_PATTERN = /\/pair-explorer\/([a-z0-9]{20,80})(?:[/?#]|$)/i;
const TOKEN_OVERVIEW_PATTERN = /\/token-overview\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i;

interface DexScreenerPairsResponse {
  pairs?: Array<{
    pairAddress?: string;
    baseToken?: { address?: string };
  }>;
}

export class DextoolsPlatform extends GenericSolanaPlatform {
  readonly chains = ['solana', 'ethereum', 'bsc', 'base'];
  private readonly pairToTokenMap = new Map<string, string>();
  private readonly tokenToRowMap = new Map<string, Element>();
  private resolutionPending = false;
  private scanCallback: (() => void) | undefined;

  constructor() {
    super({
      id: 'dextools',
      name: 'DexTools',
      hostPattern: ['*://www.dextools.io/*', '*://dextools.io/*'],
      hostnames: ['www.dextools.io', 'dextools.io'],
      currentAddressExtractor: () => {
        // 1. Token overview page — address is directly in the URL
        const tokenMatch = window.location.pathname.match(TOKEN_OVERVIEW_PATTERN);
        if (tokenMatch?.[1]) {
          return tokenMatch[1];
        }

        // 2. Pair explorer page — extract token from URL or DOM
        const pairMatch = window.location.pathname.match(PAIR_EXPLORER_PATTERN);
        if (pairMatch?.[1]) {
          // Pump.fun bonding curve: pair address ends with "pump" and IS the token mint
          if (pairMatch[1].endsWith('pump')) {
            return pairMatch[1];
          }

          // Check if we already resolved this pair
          const cached = this.pairToTokenMap.get(pairMatch[1]);
          if (cached) {
            return cached;
          }

          // Try DOM-based extraction from explorer links
          for (const anchor of Array.from(document.querySelectorAll<HTMLAnchorElement>(
            'a[href*="solscan.io/token/"], a[href*="birdeye.so/token/"]',
          ))) {
            const href = anchor.href;
            const match = href.match(/(?:solscan\.io|birdeye\.so(?:\/[a-z0-9_-]+)?)\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i);
            if (match?.[1]) {
              this.pairToTokenMap.set(pairMatch[1], match[1]);
              return match[1];
            }
          }

          // Trigger async resolution if DOM extraction failed
          if (!this.resolutionPending) {
            this.resolvePairAddresses([pairMatch[1]]).catch((err: unknown) => {
              console.error('[BarryGuard] DexTools pair resolution failed:', err);
            });
          }

          return null;
        }

        return null;
      },
      currentAddressPatterns: [
        TOKEN_OVERVIEW_PATTERN,
        /[?&](?:tokenAddress|address|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        TOKEN_OVERVIEW_PATTERN,
        /[?&](?:tokenAddress|address|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
    });
  }

  override matchesLocation(location: Location): boolean {
    const hostnameMatch = location.hostname === 'www.dextools.io' || location.hostname === 'dextools.io';
    if (!hostnameMatch) {
      return false;
    }

    // Only activate on Solana pages
    return /\/solana(?:\/|$)/i.test(location.pathname);
  }

  override observeDOMChanges(callback: () => void): void {
    this.scanCallback = callback;

    // Angular SPAs re-render aggressively — use debounced observer
    let scheduled = false;
    const schedule = () => {
      if (scheduled) {
        return;
      }

      scheduled = true;
      window.setTimeout(() => {
        scheduled = false;
        callback();
      }, 150);
    };

    const observer = new MutationObserver(() => {
      schedule();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  override extractTokenAddresses(): string[] {
    // Detail page: use the standard extractor (Solscan/Birdeye links or token-overview URL)
    const currentAddress = this.getCurrentPageAddress();
    if (currentAddress) {
      return [currentAddress];
    }

    // List page: collect pair addresses from links to pair-explorer pages
    const pairLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(
      'a[href*="pair-explorer/"], a[href*="token-overview/"]',
    ));

    if (pairLinks.length === 0) {
      return [];
    }

    const pairAddresses: string[] = [];
    const directTokenAddresses: string[] = [];

    for (const link of pairLinks) {
      const href = link.getAttribute('href') ?? '';

      // Direct token-overview links contain the token address
      const tokenMatch = href.match(TOKEN_OVERVIEW_PATTERN);
      if (tokenMatch?.[1]) {
        directTokenAddresses.push(tokenMatch[1]);
        this.tokenToRowMap.set(tokenMatch[1], link);
        continue;
      }

      // Pair-explorer links — check if pair address IS the token address
      const pairMatch = href.match(PAIR_EXPLORER_PATTERN);
      if (pairMatch?.[1]) {
        // Pump.fun bonding curve: pair address ends with "pump" and IS the token mint
        if (pairMatch[1].endsWith('pump')) {
          directTokenAddresses.push(pairMatch[1]);
          this.tokenToRowMap.set(pairMatch[1], link);
        } else {
          pairAddresses.push(pairMatch[1]);
        }
      }
    }

    // Trigger async resolution for unresolved pairs
    const unresolved = pairAddresses.filter((p) => !this.pairToTokenMap.has(p));
    if (unresolved.length > 0 && !this.resolutionPending) {
      this.resolvePairAddresses(unresolved).catch((err: unknown) => {
        console.error('[BarryGuard] DexTools pair resolution failed:', err);
      });
    }

    // Collect resolved token addresses and update row cache
    const tokenAddresses = [...directTokenAddresses];
    for (const pairAddr of pairAddresses) {
      const tokenAddr = this.pairToTokenMap.get(pairAddr);
      if (tokenAddr) {
        tokenAddresses.push(tokenAddr);
        const row = pairLinks.find((l) => (l.getAttribute('href') ?? '').includes(pairAddr));
        if (row) {
          this.tokenToRowMap.set(tokenAddr, row);
        }
      }
    }

    return dedupeAddresses(tokenAddresses);
  }

  override buildSelectedToken(address: string, score: TokenScore): SelectedToken {
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
    const main = document.querySelector('main') ?? document.querySelector('app-root') ?? document.body;

    // DexTools detail page: token name is in .name-symbol-container
    const nameSymbolContainer = main.querySelector('.name-symbol-container');
    if (nameSymbolContainer && !nameSymbolContainer.closest('[data-barryguard="true"]')) {
      return nameSymbolContainer;
    }

    // Fallback: look for headings or known token-name patterns
    const candidates = Array.from(main.querySelectorAll('h1, h2, h3, [class*="token-name"], [class*="tokenName"], [class*="pair-name"], [class*="pair-identity"] [class*="name"]'));
    for (const candidate of candidates) {
      if (candidate.closest('[data-barryguard="true"]')) {
        continue;
      }

      const text = candidate.textContent?.trim() ?? '';
      if (text && text.length > 1 && text.length < 80 && this.isLikelyTokenName(text)) {
        return candidate;
      }
    }

    const fallback = main.querySelector('h1:not([data-barryguard="true"])') ?? main.querySelector('h2:not([data-barryguard="true"])');
    return fallback;
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

      const row = document.querySelector(`a[href*="pair-explorer/${pairAddr}"]`);
      if (row) {
        this.tokenToRowMap.set(address, row);
        return row;
      }
    }

    // Try direct token-overview link
    const directLink = document.querySelector(`a[href*="token-overview/${address}"]`);
    if (directLink) {
      this.tokenToRowMap.set(address, directLink);
      return directLink;
    }

    return null;
  }

  protected override insertBadge(address: string, target: Element, badge: HTMLDivElement): void {
    if (!this.isCurrentTokenPage(address)) {
      // List row: find token symbol in center/title area, never in logo container
      const center = target.querySelector('[class*="center"], .title') ?? target;
      const nameEl = center.querySelector('[class*="symbol"]')
        ?? center.querySelector('[class*="name"]:not([class*="logo"])')
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

    // Detail page: place badge below the symbol inside the name-symbol container
    document
      .querySelectorAll(`[data-barryguard-context="${this.id}-detail"]`)
      .forEach((el) => el.remove());
    badge.setAttribute('data-barryguard-context', `${this.id}-detail`);
    badge.style.marginTop = '6px';
    badge.style.marginLeft = '0';
    badge.style.display = 'block';
    target.appendChild(badge);
  }

  private async resolvePairAddresses(pairAddresses: string[]): Promise<void> {
    this.resolutionPending = true;
    try {
      const BATCH_SIZE = 30;
      for (let i = 0; i < pairAddresses.length; i += BATCH_SIZE) {
        const batch = pairAddresses.slice(i, i + BATCH_SIZE);
        const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${batch.join(',')}`;

        let response: Response;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10_000);
          response = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
        } catch {
          continue;
        }

        if (!response.ok) {
          continue;
        }

        let data: DexScreenerPairsResponse;
        try {
          data = await response.json() as DexScreenerPairsResponse;
        } catch {
          continue;
        }

        for (const pair of data.pairs ?? []) {
          if (pair.pairAddress && pair.baseToken?.address) {
            this.pairToTokenMap.set(pair.pairAddress, pair.baseToken.address);
          }
        }
      }

      this.scanCallback?.();
    } finally {
      this.resolutionPending = false;
    }
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

  private isLikelyTokenName(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return !(
      /^[1-9a-hj-np-z]{32,44}$/i.test(value)
      || normalized === 'dextools'
      || normalized.includes('price')
      || normalized.includes('market cap')
      || normalized.includes('holders')
      || normalized.includes('watchlist')
      || normalized.includes('trending')
      || normalized.includes('trade')
      || normalized.includes('buy')
      || normalized.includes('sell')
      || normalized.includes('liquidity')
      || normalized.includes('volume')
      || normalized.includes('connect wallet')
      || normalized.includes('pair explorer')
      || normalized.includes('big swap')
      || normalized.includes('pool explorer')
    );
  }
}
