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
    const currentAddress = this.getCurrentAddress();

    if (currentAddress) {
      addresses.push(currentAddress);
      seen.add(currentAddress);
    }

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

  isCurrentTokenPage(address: string): boolean {
    return this.getCurrentAddress() === address;
  }

  buildSelectedToken(address: string, score: TokenScore): SelectedToken {
    const metadataRoot = this.isCurrentTokenPage(address)
      ? document
      : this.getLink(address);

    return {
      address,
      score,
      metadata: this.extractTokenMetadata(metadataRoot ?? document, address),
    };
  }

  renderScoreBadge(address: string, score: TokenScore): void {
    const target = this.getTargetElement(address);
    if (!target) {
      return;
    }

    const isDetailPage = this.isCurrentTokenPage(address);
    const colors = this.getColors(score.risk);
    const badge = this.getBadge(address) ?? this.createBadge(address);
    badge.style.backgroundColor = colors.bg;
    badge.style.color = colors.text;
    badge.style.border = `1px solid ${colors.border}`;
    badge.innerHTML = this.getBadgeMarkup(String(score.score), !isDetailPage);
    badge.title = `BarryGuard Score: ${score.score}/100 - Click for details`;
    badge.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      chrome.runtime.sendMessage({
        type: 'OPEN_POPUP_FOR_TOKEN',
        payload: this.buildSelectedToken(address, score),
      });
    };

    if (!this.getBadge(address)) {
      this.insertBadge(address, target, badge);
    }
  }

  renderLoadingBadge(address: string): void {
    const target = this.getTargetElement(address);
    if (!target) {
      return;
    }

    const isDetailPage = this.isCurrentTokenPage(address);
    const badge = this.getBadge(address) ?? this.createBadge(address);
    badge.style.backgroundColor = '#f3f4f6';
    badge.style.color = '#6b7280';
    badge.style.border = '1px solid #e5e7eb';
    badge.innerHTML = this.getBadgeMarkup('...', !isDetailPage);
    badge.title = 'BarryGuard: Loading...';
    badge.onclick = null;

    if (!this.getBadge(address)) {
      this.insertBadge(address, target, badge);
    }
  }

  renderErrorBadge(address: string): void {
    const badge = this.getBadge(address);
    if (!badge) {
      return;
    }

    badge.innerHTML = this.getBadgeMarkup('?', !this.isCurrentTokenPage(address));
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

  private getCurrentAddress(): string | null {
    const match = window.location.pathname.match(SELECTORS.addressPattern);
    return match?.[1] ?? null;
  }

  private getDetailTitle(): HTMLElement | null {
    return document.querySelector('h1');
  }

  private getTargetElement(address: string): Element | null {
    if (this.isCurrentTokenPage(address)) {
      return this.getDetailTitle();
    }

    return this.getLink(address);
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
      'gap:6px',
      'padding:4px 8px',
      'border-radius:999px',
      'font-size:11px',
      'font-weight:700',
      'font-family:system-ui,-apple-system,sans-serif',
      'margin-left:6px',
      'cursor:pointer',
      'transition:all 0.2s ease',
      'z-index:1000',
      'white-space:nowrap',
      'box-shadow:0 4px 10px rgba(15,23,42,0.08)',
    ].join(';');

    return badge;
  }

  private insertBadge(address: string, target: Element, badge: HTMLDivElement): void {
    if (this.isCurrentTokenPage(address)) {
      document
        .querySelectorAll('[data-barryguard-context="detail"]')
        .forEach((element) => element.remove());
      badge.setAttribute('data-barryguard-context', 'detail');
      badge.style.marginLeft = '0';
      badge.style.marginTop = '8px';
      target.insertAdjacentElement('afterend', badge);
      return;
    }

    const link = target as HTMLAnchorElement;
    const cardRoot = this.findCardRoot(link);
    const nameNode = this.findNameNode(cardRoot ?? link);
    badge.setAttribute('data-barryguard-context', 'list');
    badge.style.marginLeft = '0';
    badge.style.marginTop = '4px';

    if (nameNode) {
      nameNode.insertAdjacentElement('afterend', badge);
      return;
    }

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

  private findNameNode(root: Element): Element | null {
    for (const selector of SELECTORS.nameSelectors) {
      const matches = Array.from(root.querySelectorAll(selector));
      for (const match of matches) {
        if (match.closest('[data-barryguard="true"]')) {
          continue;
        }

        const value = match.textContent?.trim();
        if (value && value.length > 2 && value.length < 64) {
          return match;
        }
      }
    }

    return null;
  }

  private extractTokenMetadata(root: Element | Document, address: string): TokenMetadata {
    const elementRoot = root instanceof Document ? root.documentElement : root;
    const scopedRoot = elementRoot ?? document.documentElement;
    const name = this.findText(scopedRoot, SELECTORS.nameSelectors, (value) => value.length > 2 && value.length < 64);
    const symbol = this.findText(
      scopedRoot,
      SELECTORS.symbolSelectors,
      (value) => /^\$?[A-Z0-9_]{2,12}$/.test(value) && value !== name,
    );
    const imageUrl = this.findImage(scopedRoot, address);

    return {
      name: name ?? this.inferNameFromText(scopedRoot.textContent ?? ''),
      symbol: symbol ?? this.inferSymbolFromTitle() ?? this.inferSymbolFromText(scopedRoot.textContent ?? ''),
      imageUrl,
    };
  }

  private findText(root: Element, selectors: string[], isValid: (value: string) => boolean): string | undefined {
    for (const selector of selectors) {
      const matches = Array.from(root.querySelectorAll(selector));
      for (const match of matches) {
        if (match.closest('[data-barryguard="true"]')) {
          continue;
        }

        const value = match.textContent?.trim();
        if (value && isValid(value)) {
          return value;
        }
      }
    }

    return undefined;
  }

  private findImage(root: Element, address: string): string | undefined {
    const exactMatch = root.querySelector<HTMLImageElement>(`img[src*="/coin-image/${address}"]`);
    if (exactMatch?.src) {
      return exactMatch.src;
    }

    for (const selector of SELECTORS.imageSelectors) {
      const matches = Array.from(root.querySelectorAll<HTMLImageElement>(selector));
      for (const match of matches) {
        const src = match.getAttribute('src') ?? '';
        if (src.includes('/coin-image/')) {
          return match.src;
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

    return parts.find((part) => /^\$?(?=.*[A-Z])[A-Z0-9_]{2,12}$/.test(part));
  }

  private inferSymbolFromTitle(): string | undefined {
    const title = document.title.trim();
    const match = title.match(/^([A-Z0-9_]{2,20})\s+\$/);
    return match?.[1];
  }

  private getColors(risk: string): { bg: string; text: string; border: string } {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      high: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
      medium: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
      low: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
    };

    return map[risk] ?? map.high;
  }

  private getBadgeMarkup(value: string, compact = false): string {
    const label = compact ? 'BarryGuard' : 'BarryGuard';
    const labelStyle = compact
      ? 'font-size:9px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;line-height:1;'
      : 'font-size:10px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;line-height:1;';
    const valueStyle = compact
      ? 'font-size:11px;font-weight:800;line-height:1;'
      : 'font-size:12px;font-weight:800;line-height:1;';

    return [
      `<span style="${labelStyle}">${label}</span>`,
      `<span style="${valueStyle}">${value}</span>`,
    ].join('');
  }
}
