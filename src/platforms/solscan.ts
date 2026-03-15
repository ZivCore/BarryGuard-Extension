import { GenericSolanaPlatform } from './generic-solana';

export class SolscanPlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'solscan',
      name: 'Solscan',
      hostPattern: ['*://solscan.io/*', '*://*.solscan.io/*'],
      hostnames: ['solscan.io'],
      detailTargetSelectors: [
        '[data-testid="token-name"]',
        '[class*="token-name"]',
        '[class*="TokenName"]',
        '[class*="tokenInfo"] h1',
        '[class*="token-info"] h1',
        'h1',
        'h2',
        'h3',
        'h4',
      ],
      nameSelectors: [
        '[data-testid="token-name"]',
        '[class*="token-name"]',
        '[class*="TokenName"]',
        'h1',
        'h2',
        'h3',
        'h4',
        'strong',
      ],
      currentAddressPatterns: [
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:address|tokenAddress|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:address|tokenAddress|mint)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
    });
  }

  protected override getDetailTarget(): Element | null {
    if (this.isInterstitialPage()) {
      return null;
    }

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

  private isInterstitialPage(): boolean {
    const title = document.title.trim().toLowerCase();
    const bodyText = (document.body.textContent ?? '').trim().toLowerCase();
    const h1Text = document.querySelector('h1')?.textContent?.trim().toLowerCase() ?? '';

    if (title.includes('nur einen moment') || title.includes('just a moment')) {
      return true;
    }

    if (h1Text === 'solscan.io' && (
      bodyText.includes('checking your browser before accessing')
      || bodyText.includes('verify you are human')
      || bodyText.includes('warten auf antwort von solscan.io')
      || bodyText.includes('es wird verifiziert, dass sie ein mensch sind')
    )) {
      return true;
    }

    return false;
  }

  private findHeuristicDetailTarget(): Element | null {
    const main = document.querySelector('main') ?? document.body;
    if (!main) {
      return null;
    }

    const candidates = Array.from(main.querySelectorAll(
      'h1, h2, h3, h4, [class*="title"], [class*="Title"], [class*="name"], [class*="Name"], strong, header span, header div',
    ));

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

  private isLikelyTokenName(value: string): boolean {
    if (!value || value.length < 2 || value.length > 80) {
      return false;
    }

    const normalized = value.trim().toLowerCase();
    if (
      normalized === 'solscan.io'
      || normalized.includes('security verification')
      || normalized.includes('checking your browser')
      || normalized.includes('verify you are human')
      || normalized.includes('sicherheitsüberprüfung')
      || normalized.includes('es wird verifiziert')
      || normalized.includes('warten auf antwort')
    ) {
      return false;
    }

    return true;
  }
}
