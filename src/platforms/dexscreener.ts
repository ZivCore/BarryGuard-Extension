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

// Pair-page href pattern: /{chain}/{pairAddress}
const PAIR_HREF_PATTERN = /^\/[a-z0-9]+\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i;

interface DexScreenerPairsResponse {
  pairs?: Array<{
    pairAddress?: string;
    baseToken?: { address?: string };
  }>;
}

export class DexScreenerPlatform extends GenericSolanaPlatform {
  private readonly pairToTokenMap = new Map<string, string>();
  private readonly tokenToRowMap = new Map<string, Element>();
  private resolutionPending = false;
  private scanCallback: (() => void) | undefined;

  constructor() {
    super({
      id: 'dexscreener',
      name: 'Dexscreener',
      hostPattern: ['*://dexscreener.com/*'],
      hostnames: ['dexscreener.com'],
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

  override extractTokenAddresses(): string[] {
    // Detail page: use the standard extractor (solscan/birdeye links)
    const currentAddress = this.getCurrentPageAddress();
    if (currentAddress) {
      return [currentAddress];
    }

    // List page: collect pair addresses from rows
    const rows = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.ds-dex-table-row'));
    if (rows.length === 0) {
      return [];
    }

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
      void this.resolvePairAddresses(unresolved);
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

      const row = document.querySelector(`a.ds-dex-table-row[href*="${pairAddr}"]`);
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
      const nameEl = target.querySelector('.ds-dex-table-row-base-token-name-text')
        ?? target.querySelector('.ds-dex-table-row-base-token-symbol')
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

  private async resolvePairAddresses(pairAddresses: string[]): Promise<void> {
    this.resolutionPending = true;
    try {
      const BATCH_SIZE = 30;
      for (let i = 0; i < pairAddresses.length; i += BATCH_SIZE) {
        const batch = pairAddresses.slice(i, i + BATCH_SIZE);
        const url = `https://api.dexscreener.com/latest/dex/pairs/solana/${batch.join(',')}`;

        let response: Response;
        try {
          response = await fetch(url);
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
}
