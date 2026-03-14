import type { IPlatform } from './platform.interface';
import type { SelectedToken, TokenMetadata, TokenScore } from '../shared/types';
import { PLATFORM_SELECTORS } from '../config/selectors';

const SELECTORS = PLATFORM_SELECTORS.pumpfun;

export class PumpFunPlatform implements IPlatform {
  readonly name = 'Pump.fun';
  readonly hostPattern = ['*://pump.fun/*'];

  extractTokenAddresses(): string[] {
    const addresses: string[] = [];
    const seen = new Set<string>();

    document.querySelectorAll<HTMLAnchorElement>(SELECTORS.tokenLink).forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) {
        return;
      }

      const match = href.match(SELECTORS.addressPattern);
      if (match?.[1] && !seen.has(match[1])) {
        addresses.push(match[1]);
        seen.add(match[1]);
      }
    });

    return addresses;
  }

  renderScoreBadge(address: string, score: TokenScore): void {
    const link = this.getLink(address);
    if (!link) {
      return;
    }

    const colors = this.getColors(score.risk);
    const badge = this.getBadge(address) ?? this.createBadge(address);
    badge.style.backgroundColor = colors.bg;
    badge.style.color = colors.text;
    badge.style.border = `1px solid ${colors.border}`;
    badge.textContent = String(score.score);
    badge.title = `BarryGuard Score: ${score.score}/100 - Click for details`;
    badge.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      const selectedToken: SelectedToken = {
        address,
        score,
        metadata: this.extractTokenMetadata(link),
      };

      chrome.runtime.sendMessage({
        type: 'OPEN_POPUP_FOR_TOKEN',
        payload: selectedToken,
      });
    };

    if (!this.getBadge(address)) {
      this.insertBadge(link, badge);
    }
  }

  renderLoadingBadge(address: string): void {
    const link = this.getLink(address);
    if (!link) {
      return;
    }

    const badge = this.getBadge(address) ?? this.createBadge(address);
    badge.style.backgroundColor = '#f3f4f6';
    badge.style.color = '#6b7280';
    badge.style.border = '1px solid #e5e7eb';
    badge.textContent = '...';
    badge.title = 'BarryGuard: Loading...';
    badge.onclick = null;

    if (!this.getBadge(address)) {
      this.insertBadge(link, badge);
    }
  }

  renderErrorBadge(address: string): void {
    const badge = this.getBadge(address);
    if (!badge) {
      return;
    }

    badge.textContent = '?';
    badge.title = 'BarryGuard: Score unavailable';
    badge.style.backgroundColor = '#f3f4f6';
    badge.style.color = '#9ca3af';
    badge.style.border = '1px solid #e5e7eb';
    badge.onclick = null;
  }

  observeDOMChanges(callback: () => void): void {
    const observer = new MutationObserver((mutations) => {
      const hasNewTokenNodes = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return false;
          }

          const element = node as Element;
          return element.matches(SELECTORS.tokenLink) || !!element.querySelector(SELECTORS.tokenLink);
        }));

      if (hasNewTokenNodes) {
        setTimeout(callback, 100);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  private getLink(address: string): HTMLAnchorElement | null {
    return document.querySelector(`a[href="/coin/${address}"]`);
  }

  private getBadge(address: string): HTMLDivElement | null {
    return document.querySelector(`[data-barryguard-badge="${address}"]`);
  }

  private createBadge(address: string): HTMLDivElement {
    const badge = document.createElement('div');
    badge.setAttribute('data-barryguard-badge', address);
    badge.setAttribute('data-barryguard', 'true');
    badge.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'padding:2px 6px',
      'border-radius:4px',
      'font-size:11px',
      'font-weight:600',
      'font-family:system-ui,-apple-system,sans-serif',
      'margin-left:6px',
      'cursor:pointer',
      'transition:all 0.2s ease',
      'z-index:1000',
    ].join(';');

    return badge;
  }

  private insertBadge(link: HTMLAnchorElement, badge: HTMLDivElement): void {
    const cardRoot = this.findCardRoot(link);
    const insertionPoint = this.findInsertionPoint(cardRoot ?? link);
    if (insertionPoint) {
      insertionPoint.insertAdjacentElement('afterend', badge);
      return;
    }

    link.appendChild(badge);
  }

  private findCardRoot(link: HTMLAnchorElement): Element | null {
    for (const selector of SELECTORS.cardContainerSelectors) {
      const cardRoot = link.closest(selector) ?? link.querySelector(selector);
      if (cardRoot) {
        return cardRoot;
      }
    }

    return link;
  }

  private findInsertionPoint(root: Element): Element | null {
    for (const selector of SELECTORS.insertionPointSelectors) {
      const candidate = root.querySelector(selector);
      if (candidate) {
        return candidate;
      }
    }

    return null;
  }

  private extractTokenMetadata(link: HTMLAnchorElement): TokenMetadata {
    const cardRoot = this.findCardRoot(link) ?? link;
    const name = this.findText(cardRoot, SELECTORS.nameSelectors, (value) => value.length > 2 && value.length < 64);
    const symbol = this.findText(
      cardRoot,
      SELECTORS.symbolSelectors,
      (value) => /^\$?[A-Z0-9_]{2,12}$/.test(value) && value !== name,
    );

    return {
      name: name ?? this.inferNameFromText(cardRoot.textContent ?? ''),
      symbol: symbol ?? this.inferSymbolFromText(cardRoot.textContent ?? ''),
    };
  }

  private findText(root: Element, selectors: string[], isValid: (value: string) => boolean): string | undefined {
    for (const selector of selectors) {
      const matches = Array.from(root.querySelectorAll(selector));
      for (const match of matches) {
        const value = match.textContent?.trim();
        if (value && isValid(value)) {
          return value;
        }
      }
    }

    return undefined;
  }

  private inferNameFromText(text: string): string | undefined {
    const parts = text
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 2 && part.length < 32);

    return parts.find((part) => !/^\$?[A-Z0-9_]{2,12}$/.test(part));
  }

  private inferSymbolFromText(text: string): string | undefined {
    const parts = text
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    return parts.find((part) => /^\$?[A-Z0-9_]{2,12}$/.test(part));
  }

  private getColors(risk: string): { bg: string; text: string; border: string } {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      high: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
      medium: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
      low: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
    };

    return map[risk] ?? map.high;
  }
}
