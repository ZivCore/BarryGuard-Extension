// src/platforms/pumpfun.ts
import type { IPlatform } from './platform.interface';
import type { TokenScore } from '../shared/types';
import { PLATFORM_SELECTORS } from '../config/selectors';

const SELECTORS = PLATFORM_SELECTORS.pumpfun;

export class PumpFunPlatform implements IPlatform {
  readonly name = 'Pump.fun';
  readonly hostPattern = ['*://pump.fun/*'];

  extractTokenAddresses(): string[] {
    const addresses: string[] = [];
    const seen = new Set<string>();

    document.querySelectorAll<HTMLAnchorElement>(SELECTORS.tokenLink).forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      const match = href.match(SELECTORS.addressPattern);
      if (match?.[1] && !seen.has(match[1])) {
        addresses.push(match[1]);
        seen.add(match[1]);
      }
    });

    return addresses;
  }

  renderScoreBadge(address: string, score: TokenScore): void {
    const link = document.querySelector(`a[href="/coin/${address}"]`);
    if (!link) return;
    if (link.querySelector(`[data-barryguard-badge="${address}"]`)) return;

    const colors = this.getColors(score.risk);
    const badge = document.createElement('div');
    badge.setAttribute('data-barryguard-badge', address);
    badge.setAttribute('data-barryguard', 'true');
    badge.style.cssText = [
      'display:inline-flex', 'align-items:center', 'justify-content:center',
      'padding:2px 6px', 'border-radius:4px', 'font-size:11px', 'font-weight:600',
      'font-family:system-ui,-apple-system,sans-serif', 'margin-left:6px',
      'cursor:pointer', 'transition:all 0.2s ease', 'z-index:1000',
      `background-color:${colors.bg}`, `color:${colors.text}`, `border:1px solid ${colors.border}`,
    ].join(';');

    badge.textContent = `${score.score}`;
    badge.title = `BarryGuard Score: ${score.score}/100 — Click for details`;

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chrome.storage.local.set({ selectedToken: { address, score } });
    });

    const container = (link.querySelector(SELECTORS.cardContainer) ?? link)
      .querySelector(SELECTORS.insertionPoint);
    container
      ? container.insertAdjacentElement('afterend', badge)
      : link.appendChild(badge);
  }

  renderLoadingBadge(address: string): void {
    const link = document.querySelector(`a[href="/coin/${address}"]`);
    if (!link || link.querySelector(`[data-barryguard-badge="${address}"]`)) return;

    const badge = document.createElement('div');
    badge.setAttribute('data-barryguard-badge', address);
    badge.setAttribute('data-barryguard', 'true');
    badge.style.cssText = [
      'display:inline-flex', 'align-items:center', 'justify-content:center',
      'padding:2px 6px', 'border-radius:4px', 'font-size:11px', 'font-weight:600',
      'font-family:system-ui,-apple-system,sans-serif', 'margin-left:6px', 'z-index:1000',
      'background-color:#f3f4f6', 'color:#6b7280', 'border:1px solid #e5e7eb',
    ].join(';');
    badge.textContent = '...';
    badge.title = 'BarryGuard: Loading...';

    const container = (link.querySelector(SELECTORS.cardContainer) ?? link)
      .querySelector(SELECTORS.insertionPoint);
    container
      ? container.insertAdjacentElement('afterend', badge)
      : link.appendChild(badge);
  }

  renderErrorBadge(address: string): void {
    const badge = document.querySelector(`[data-barryguard-badge="${address}"]`);
    if (!badge) return;
    (badge as HTMLElement).textContent = '?';
    badge.setAttribute('title', 'BarryGuard: Score unavailable');
    (badge as HTMLElement).style.backgroundColor = '#f3f4f6';
    (badge as HTMLElement).style.color = '#9ca3af';
  }

  observeDOMChanges(callback: () => void): void {
    const observer = new MutationObserver((mutations) => {
      const hasNew = mutations.some(m =>
        Array.from(m.addedNodes).some(n => {
          if (n.nodeType !== Node.ELEMENT_NODE) return false;
          const el = n as Element;
          return el.matches(SELECTORS.tokenLink) || !!el.querySelector(SELECTORS.tokenLink);
        })
      );
      if (hasNew) setTimeout(callback, 100);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  removeBadges(): void {
    document.querySelectorAll('[data-barryguard-badge]').forEach(b => b.remove());
  }

  private getColors(risk: string): { bg: string; text: string; border: string } {
    const map: Record<string, { bg: string; text: string; border: string }> = {
      high:   { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
      medium: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
      low:    { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
    };
    return map[risk] ?? map.high;
  }
}
