import type { IPlatform } from './platform.interface';
import type { SelectedToken, TokenMetadata, TokenScore } from '../shared/types';
import { extractPumpFunEmbeddedMetadata } from '../shared/pumpfun-metadata';
import { PLATFORM_SELECTORS } from '../config/selectors';
import { createBadgeElement, getRiskColors, safeSendPopupMessage, setBadgeContent } from './platform-utils';

const SELECTORS = PLATFORM_SELECTORS.pumpfun;

export class PumpFunPlatform implements IPlatform {
  readonly id = 'pumpfun';
  readonly name = 'Pump.fun';
  readonly hostPattern = ['*://pump.fun/*'];

  matchesLocation(location: Location): boolean {
    if (location.hostname !== 'pump.fun') {
      return false;
    }

    return !/(?:^|\/)(swap|advanced)(?:\/|$)/i.test(location.pathname);
  }

  extractTokenAddresses(): string[] {
    const addresses: string[] = [];
    const seen = new Set<string>();
    const currentAddress = this.getCurrentPageAddress();

    if (currentAddress) {
      addresses.push(currentAddress);
      seen.add(currentAddress);
    }

    document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) {
        return;
      }

      const match = href.match(/^\/(?:coin\/)?([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/);
      if (match?.[1] && !seen.has(match[1])) {
        addresses.push(match[1]);
        seen.add(match[1]);
      }
    });

    return addresses;
  }

  isCurrentTokenPage(address: string): boolean {
    return this.getCurrentPageAddress() === address;
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

    const colors = this.getColors(score.risk);
    const badge = this.getBadge(address) ?? this.createBadge(address);
    badge.removeAttribute('data-barryguard-locked');
    badge.style.backgroundColor = colors.bg;
    badge.style.color = colors.text;
    badge.style.border = `1px solid ${colors.border}`;
    setBadgeContent(badge, String(score.score));
    badge.title = `BarryGuard Score: ${score.score}/100 - Click for details`;
    badge.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();

      safeSendPopupMessage(this.buildSelectedToken(address, score));
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

    const badge = this.getBadge(address) ?? this.createBadge(address);
    badge.style.backgroundColor = '#f3f4f6';
    badge.style.color = '#6b7280';
    badge.style.border = '1px solid #e5e7eb';
    setBadgeContent(badge, '...');
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

    setBadgeContent(badge, '?');
    badge.title = 'BarryGuard: Score unavailable';
    badge.style.backgroundColor = '#f3f4f6';
    badge.style.color = '#9ca3af';
    badge.style.border = '1px solid #e5e7eb';
    badge.onclick = null;
  }

  renderLockedBadge(address: string): void {
    const target = this.getTargetElement(address);
    if (!target) {
      return;
    }

    const existingBadge = this.getBadge(address);
    const badge = existingBadge ?? this.createBadge(address);
    badge.style.backgroundColor = '#f3f4f6';
    badge.style.color = '#6b7280';
    badge.style.border = '1px solid #d1d5db';
    setBadgeContent(badge, '🔒', false);
    badge.title = 'BarryGuard: Upgrade for full analysis';
    badge.setAttribute('data-barryguard-locked', 'true');
    badge.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      safeSendPopupMessage({ address, locked: true });
    };

    if (!existingBadge) {
      this.insertBadge(address, target, badge);
    }
  }

  observeDOMChanges(callback: () => void): void {
    const observer = new MutationObserver((mutations) => {
      const isDetailPage = Boolean(this.getCurrentPageAddress());

      const hasRelevantNodes = mutations.some((mutation) =>
        Array.from(mutation.addedNodes).some((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return false;
          }

          const element = node as Element;

          if (isDetailPage) {
            // On coin pages, re-scan when h1 appears (page hydrated after SPA nav or initial load)
            return element.matches('h1') || !!element.querySelector('h1');
          }

          return element.matches('a[href]') || !!element.querySelector('a[href]');
        }));

      if (hasRelevantNodes) {
        setTimeout(callback, 100);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  private getLink(address: string): HTMLAnchorElement | null {
    return document.querySelector(`a[href="/coin/${address}"], a[href="/${address}"]`);
  }

  getCurrentPageAddress(): string | null {
    const match = window.location.pathname.match(/^\/(?:coin\/)?([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/);
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
    return createBadgeElement(address);
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
    const mcNode = this.findMcNode(cardRoot ?? link);
    badge.setAttribute('data-barryguard-context', 'list');
    badge.style.marginLeft = '0';
    badge.style.marginTop = '4px';
    badge.style.display = 'flex';

    if (mcNode) {
      mcNode.insertAdjacentElement('afterend', badge);
      return;
    }

    const nameNode = this.findNameNode(cardRoot ?? link);
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

  private findMcNode(root: Element): Element | null {
    // pump.fun renders the label and value as separate nodes:
    //   <span>MC</span><div>$5.6K</div>
    // both inside a flex row. We find the "MC" label span and return
    // its grandparent (the row container) so the badge inserts after the row.
    const candidates = Array.from(root.querySelectorAll('span, p'));
    for (const el of candidates) {
      if (el.closest('[data-barryguard="true"]')) {
        continue;
      }

      if (el.textContent?.trim() === 'MC') {
        return el.parentElement?.parentElement ?? el.parentElement ?? el;
      }
    }

    return null;
  }

  private extractTokenMetadata(root: Element | Document, address: string): TokenMetadata {
    const elementRoot = root instanceof Document ? root.documentElement : root;
    const scopedRoot = elementRoot ?? document.documentElement;
    const embeddedMetadata = this.isCurrentTokenPage(address)
      ? extractPumpFunEmbeddedMetadata(address, document.documentElement.innerHTML)
      : {};
    const name = this.findText(scopedRoot, SELECTORS.nameSelectors, (value) => value.length > 2 && value.length < 64);
    const symbol = this.findText(
      scopedRoot,
      SELECTORS.symbolSelectors,
      (value) => /^\$?[A-Z0-9_]{2,12}$/.test(value) && value !== name,
    );
    const imageUrl = this.findImage(scopedRoot, address);

    return {
      name: embeddedMetadata.name ?? name ?? this.inferNameFromText(scopedRoot.textContent ?? ''),
      symbol: embeddedMetadata.symbol ?? symbol ?? this.inferSymbolFromTitle() ?? this.inferSymbolFromText(scopedRoot.textContent ?? ''),
      imageUrl: embeddedMetadata.imageUrl ?? imageUrl,
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
    return getRiskColors(risk);
  }
}
