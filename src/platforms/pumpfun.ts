/**
 * Pump.fun Platform Implementation
 * Detects and analyzes token cards on pump.fun
 */

import type { IPlatform } from './platform.interface';

export class PumpFunPlatform implements IPlatform {
  readonly name = 'Pump.fun';
  readonly hostPattern = ['*://pump.fun/*'];

  /**
   * Extract all token addresses from current page
   */
  extractTokenAddresses(): string[] {
    const addresses: string[] = [];
    const seen = new Set<string>();

    // Find all token card links
    const tokenLinks = document.querySelectorAll('a[href^="/coin/"]');

    tokenLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;

      // Extract address from /coin/[ADDRESS]
      const address = href.replace('/coin/', '');

      // Validate Solana address format (Base58, 32-44 chars)
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address) && !seen.has(address)) {
        addresses.push(address);
        seen.add(address);
      }
    });

    return addresses;
  }

  /**
   * Render score badge next to token card
   */
  renderScoreBadge(address: string, score: number, risk: 'high' | 'medium' | 'low'): void {
    // Find the token card link for this address
    const link = document.querySelector(`a[href="/coin/${address}"]`);
    if (!link) return;

    // Check if badge already exists
    if (link.querySelector('[data-barryguard-badge]')) return;

    // Create badge element
    const badge = document.createElement('div');
    badge.setAttribute('data-barryguard-badge', address);
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      font-family: system-ui, -apple-system, sans-serif;
      margin-left: 8px;
      cursor: pointer;
      transition: all 0.2s;
      ${this.getBadgeStyles(risk)}
    `;

    badge.textContent = `${score}`;
    badge.title = `BarryGuard Score: ${score}/100 (${risk.toUpperCase()} RISK)`;

    // Insert badge into card (find insertion point)
    const cardContainer = link.querySelector('generic');
    if (cardContainer) {
      // Insert after token name
      const tokenName = cardContainer.querySelector('paragraph');
      if (tokenName) {
        tokenName.insertAdjacentElement('afterend', badge);
      } else {
        cardContainer.appendChild(badge);
      }
    }
  }

  /**
   * Get badge color based on risk level
   */
  private getBadgeStyles(risk: 'high' | 'medium' | 'low'): string {
    switch (risk) {
      case 'high':
        return `
          background-color: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        `;
      case 'medium':
        return `
          background-color: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
        `;
      case 'low':
        return `
          background-color: #d1fae5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        `;
    }
  }

  /**
   * Observe DOM changes for dynamically loaded tokens
   */
  observeDOMChanges(callback: () => void): void {
    const observer = new MutationObserver((mutations) => {
      let hasNewTokens = false;

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            // Check if new token cards were added
            if (element.matches('a[href^="/coin/"]') ||
                element.querySelector('a[href^="/coin/"]')) {
              hasNewTokens = true;
            }
          }
        });
      });

      if (hasNewTokens) {
        callback();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Remove all BarryGuard badges (cleanup)
   */
  removeBadges(): void {
    document.querySelectorAll('[data-barryguard-badge]').forEach(badge => {
      badge.remove();
    });
  }
}
