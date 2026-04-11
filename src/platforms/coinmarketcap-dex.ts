import { GenericSolanaPlatform } from './generic-solana';

export class CoinMarketCapDexPlatform extends GenericSolanaPlatform {
  readonly chains = ['solana', 'ethereum', 'bsc', 'base'];

  constructor() {
    super({
      id: 'coinmarketcap-dex',
      name: 'CoinMarketCap DEX',
      hostPattern: ['*://dex.coinmarketcap.com/*'],
      hostnames: ['dex.coinmarketcap.com'],
      currentAddressExtractor: () => {
        // Prefer pathname-based extraction to avoid accidentally picking up other mints from query params.
        const path = window.location.pathname ?? '';
        const match =
          path.match(/\/dexscan\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i)
          ?? path.match(/\/token\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i)
          ?? path.match(/\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i);

        return match?.[1] ?? null;
      },
      currentAddressPatterns: [
        // Common DEX token detail routes
        /\/dexscan\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /\/token\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:tokenAddress|address|mint|baseMint|outputMint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /\/dexscan\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /\/token\/solana\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
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

  protected override getDetailTarget(): Element | null {
    // CMC DEX detail header structure is stable and includes both name and symbol.
    const header =
      document.querySelector('.TopStats_tokenName__cpLx8')
      ?? document.querySelector('.TopStats_tokenNameWrapper__kZbHz')
      ?? document.querySelector('main .TopStats_tokenName__cpLx8')
      ?? document.querySelector('main .TopStats_tokenNameWrapper__kZbHz');

    if (header && !header.closest('[data-barryguard="true"]')) {
      return header;
    }

    return super.getDetailTarget();
  }

  /**
   * CMC DEX token pages typically render "Name Symbol" in one heading.
   * We want: Name → Symbol → Badge (inline), not the default "below heading".
   */
  protected override insertBadge(address: string, target: Element, badge: HTMLDivElement): void {
    const isDetail = this.isCurrentTokenPage(address);
    if (isDetail) {
      document
        .querySelectorAll(`[data-barryguard-context="${this.id}-detail"]`)
        .forEach((element) => element.remove());
      badge.setAttribute('data-barryguard-context', `${this.id}-detail`);
    } else {
      badge.setAttribute('data-barryguard-context', `${this.id}-list`);
    }

    // Inline appearance (CMC expects it next to name/symbol).
    badge.style.marginTop = '0';
    badge.style.marginLeft = '8px';
    badge.style.display = 'inline-flex';
    badge.style.verticalAlign = 'middle';

    const symbolNode =
      this.findSymbolNodeNextToHeading(target)
      ?? this.findSymbolNodeInHeading(target);
    if (symbolNode) {
      symbolNode.insertAdjacentElement('afterend', badge);
      return;
    }

    // Fallback: behave like the base platform insertion.
    super.insertBadge(address, target, badge);
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

  private findSymbolNodeNextToHeading(target: Element): Element | null {
    // CMC commonly renders `<h1>NAME</h1><span>SYMBOL</span>` as siblings.
    const heading = target.matches('h1, h2')
      ? target
      : target.querySelector('h1, h2');
    if (!heading) return null;

    const container = heading.parentElement;
    if (!container) return null;

    const siblings = Array.from(container.children);
    const headingIndex = siblings.indexOf(heading as Element);
    if (headingIndex === -1) return null;

    for (let i = headingIndex + 1; i < siblings.length; i++) {
      const el = siblings[i];
      if (el.closest('[data-barryguard="true"]')) continue;
      const text = el.textContent?.trim() ?? '';
      if (/^\$?[A-Z0-9_]{2,16}$/.test(text)) {
        return el;
      }
    }

    return null;
  }
}

