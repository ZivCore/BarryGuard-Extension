import { GenericSolanaPlatform } from './generic-solana';
import type { SelectedToken, TokenScore } from '../shared/types';

const DEXSCREENER_TOKEN_LINK_SELECTORS = [
  'a[href*="solscan.io/token/"]',
  'a[href*="birdeye.so/token/"]',
  'a[href*="/token/"]',
  '[data-token-address]',
  '[data-pair-base-token]',
  '[data-base-token]',
];

export class DexScreenerPlatform extends GenericSolanaPlatform {
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
