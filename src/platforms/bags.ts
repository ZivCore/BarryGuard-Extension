import { GenericSolanaPlatform } from './generic-solana';

export class BagsPlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'bags',
      name: 'Bags',
      hostPattern: ['*://bags.fm/*'],
      hostnames: ['bags.fm'],
      detailTargetSelectors: [
        'h2',
        'h1',
        '[data-testid="token-name"]',
        '[data-testid*="token-name"]',
        '[class*="tokenName"]',
        '[class*="token-name"]',
        '[class*="title"]',
        '[class*="name"]',
      ],
      nameSelectors: [
        'h1',
        'h2',
        '[data-testid="token-name"]',
        '[data-testid*="token-name"]',
        '[class*="tokenName"]',
        '[class*="token-name"]',
        '[class*="title"]',
        '[class*="name"]',
        'strong',
      ],
      currentAddressPatterns: [
        /^\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:address|tokenAddress|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /^\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
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
    const normalized = primary.replace(/\son bags$/i, '').trim();
    return this.isLikelyTokenName(normalized) ? normalized : null;
  }

  private isLikelyTokenName(value: string): boolean {
    if (!value || value.length < 2 || value.length > 80) {
      return false;
    }

    const normalized = value.trim().toLowerCase();
    if (
      /^[1-9a-hj-np-z]{32,44}$/i.test(value)
      || normalized === 'bags'
      || normalized.includes('market cap')
      || normalized.includes('holders')
      || normalized.includes('comments')
      || normalized.includes('transactions')
      || normalized.includes('trade')
      || normalized.includes('buy')
      || normalized.includes('sell')
      || normalized.includes('secure')
      || normalized.includes('launch')
      || normalized.includes('connect wallet')
    ) {
      return false;
    }

    return true;
  }
}
