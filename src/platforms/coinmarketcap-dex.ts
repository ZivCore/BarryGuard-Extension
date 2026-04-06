import { GenericSolanaPlatform } from './generic-solana';

export class CoinMarketCapDexPlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'coinmarketcap-dex',
      name: 'CoinMarketCap DEX',
      hostPattern: ['*://dex.coinmarketcap.com/*'],
      hostnames: ['dex.coinmarketcap.com'],
      currentAddressPatterns: [
        // Common DEX token detail routes
        /\/dexscan\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:tokenAddress|address|mint|baseMint|outputMint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /\/dexscan\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:tokenAddress|address|mint|baseMint|outputMint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      detailTargetSelectors: [
        'main h1',
        'main h2',
        'main [data-testid*="token" i] h1',
        'h1',
        'h2',
      ],
      compactBadge: true,
    });
  }

  /**
   * CMC DEX token pages typically render "Name Symbol" in one heading.
   * We want: Name → Symbol → Badge (inline), not the default "below heading".
   */
  protected override insertBadge(address: string, target: Element, badge: HTMLDivElement): void {
    if (!this.isCurrentTokenPage(address)) {
      super.insertBadge(address, target, badge);
      return;
    }

    document
      .querySelectorAll(`[data-barryguard-context="${this.id}-detail"]`)
      .forEach((element) => element.remove());

    badge.setAttribute('data-barryguard-context', `${this.id}-detail`);
    badge.style.marginTop = '0';
    badge.style.marginLeft = '8px';
    badge.style.display = 'inline-flex';

    const symbolNode = this.findSymbolNodeInHeading(target);
    if (symbolNode) {
      symbolNode.insertAdjacentElement('afterend', badge);
      return;
    }

    target.insertAdjacentElement('afterend', badge);
  }

  private findSymbolNodeInHeading(target: Element): Element | null {
    const root = target instanceof HTMLElement ? target : null;
    if (!root) return null;

    // Prefer obvious "symbol" classes, otherwise fall back to heuristic matching.
    const preferred =
      root.querySelector('[data-token-symbol]')
      || root.querySelector('[data-testid*="symbol" i]')
      || root.querySelector('[class*="symbol" i]')
      || root.querySelector('[class*="ticker" i]');
    if (preferred) return preferred;

    const candidates = Array.from(root.querySelectorAll('span, p, strong, b'));
    for (const el of candidates) {
      const text = el.textContent?.trim() ?? '';
      if (/^\$?[A-Z0-9_]{2,16}$/.test(text)) {
        return el;
      }
    }

    return null;
  }
}

