import { GenericSolanaPlatform } from './generic-solana';

export class BirdeyePlatform extends GenericSolanaPlatform {
  constructor() {
    const tokenRoutePattern = /\/(?:[a-z0-9_-]+\/)?token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i;

    super({
      id: 'birdeye',
      name: 'Birdeye',
      hostPattern: ['*://birdeye.so/*'],
      hostnames: ['birdeye.so'],
      detailTargetSelectors: [
        '[data-testid="token-name"]',
        '[data-testid*="token-name"]',
        '[data-testid*="name"]',
        '[class*="tokenName"]',
        '[class*="token-name"]',
        '[class*="tokenInfo"] h1',
        '[class*="token-info"] h1',
        'h1',
        'h2',
      ],
      nameSelectors: [
        '[data-testid="token-name"]',
        '[data-testid*="token-name"]',
        '[data-testid*="name"]',
        '[class*="tokenName"]',
        '[class*="token-name"]',
        'h1',
        'h2',
        'strong',
        'span',
      ],
      currentAddressPatterns: [
        tokenRoutePattern,
        /[?&](?:address|tokenAddress|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        tokenRoutePattern,
        /[?&](?:address|tokenAddress|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
    });
  }

  protected override getDetailTarget(): Element | null {
    const explicitTarget = super.getDetailTarget();
    if (explicitTarget) {
      return explicitTarget;
    }

    return this.findHeuristicDetailTarget();
  }

  override extractTokenAddresses(): string[] {
    const current = this.getCurrentPageAddress();
    if (current) {
      return [current];
    }

    return super.extractTokenAddresses();
  }

  protected override extractAddressFromNode(node: Element): string | null {
    const href = node.getAttribute('href') ?? '';
    if (href && /\/address\/[1-9A-HJ-NP-Za-km-z]{32,44}/.test(href)) {
      return null;
    }

    return super.extractAddressFromNode(node);
  }

  override observeDOMChanges(callback: () => void): void {
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
      attributes: true,
    });
  }

  private findHeuristicDetailTarget(): Element | null {
    const root = document.querySelector('main') ?? document.body;
    if (!root) {
      return null;
    }

    const titleTokenName = this.getTitleTokenName();
    const candidates = Array.from(root.querySelectorAll(
      'h1, h2, [data-testid*="name"], [class*="title"], [class*="Title"], [class*="name"], [class*="Name"], strong, header span, header div, span, div',
    ));

    if (titleTokenName) {
      for (const candidate of candidates) {
        if (candidate.closest('[data-barryguard="true"]')) {
          continue;
        }

        const text = candidate.textContent?.trim() ?? '';
        if (!text) {
          continue;
        }

        if (text === titleTokenName || text.includes(titleTokenName) || titleTokenName.includes(text)) {
          return candidate;
        }
      }
    }

    for (const candidate of candidates) {
      if (candidate.closest('[data-barryguard="true"]')) {
        continue;
      }

      const text = candidate.textContent?.trim() ?? '';
      if (!this.isLikelyTokenName(text)) {
        continue;
      }

      return candidate;
    }

    return null;
  }

  private getTitleTokenName(): string | null {
    const rawTitle = document.title.trim();
    if (!rawTitle) {
      return null;
    }

    const primary = rawTitle.split('|')[0]?.trim() ?? rawTitle;
    const normalized = primary
      .replace(/\bprice\b.*$/i, '')
      .replace(/\bon birdeye\b/i, '')
      .trim();

    return this.isLikelyTokenName(normalized) ? normalized : null;
  }

  private isLikelyTokenName(value: string): boolean {
    if (!value || value.length < 2 || value.length > 80) {
      return false;
    }

    const normalized = value.trim().toLowerCase();
    if (
      /^[1-9a-hj-np-z]{32,44}$/i.test(value)
      || normalized === 'birdeye'
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
      || normalized.includes('security')
      || normalized.includes('verify')
      || normalized.includes('connect wallet')
    ) {
      return false;
    }

    return true;
  }
}
