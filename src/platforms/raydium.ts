import { GenericSolanaPlatform } from './generic-solana';
import { pickPreferredSolanaAddress } from './address-helpers';
import { createBadgeElement, getRiskColors, renderBadgeTooltip, safeSendPopupMessage, setBadgeContent } from './platform-utils';
import type { TokenScore } from '../shared/types';

const COMMON_SOLANA_QUOTES = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD2c3YQm6P88GJEqn3EjjqY',
]);

export class RaydiumPlatform extends GenericSolanaPlatform {
  constructor() {
    super({
      id: 'raydium',
      name: 'Raydium',
      hostPattern: ['*://raydium.io/*'],
      hostnames: ['raydium.io'],
      detailTargetSelectors: [
        '[data-sentry-component="Info"]',
        '[data-sentry-source-file="Info.tsx"]',
        '[data-sentry-component="TokenDetail"]',
        '[data-token-name]',
        'h1',
      ],
      nameSelectors: [
        '[data-sentry-component="Info"] [data-sentry-element="Text"]',
        '[data-sentry-source-file="Info.tsx"] [data-sentry-element="Text"]',
        '[data-token-name]',
        'h1',
        'h2',
        'p',
        'span',
      ],
      currentAddressExtractor: (location) => {
        const params = new URLSearchParams(location.search);
        return pickPreferredSolanaAddress(
          [
            params.get('outputMint'),
            params.get('inputMint'),
            params.get('baseMint'),
            params.get('quoteMint'),
            params.get('mint'),
            params.get('tokenAddress'),
          ],
          COMMON_SOLANA_QUOTES,
        );
      },
      currentAddressPatterns: [
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:outputMint|inputMint|baseMint|quoteMint|mint|tokenAddress)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})(?:[/?#]|$)/i,
        /[?&](?:outputMint|inputMint|baseMint|quoteMint|mint|tokenAddress)=([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
    });
  }

  protected override getDetailTarget(): Element | null {
    const launchpadTokenName = this.findLaunchpadTokenName();
    if (launchpadTokenName) {
      return launchpadTokenName;
    }

    return super.getDetailTarget();
  }

  override renderScoreBadge(address: string, score: TokenScore): void {
    const placement = this.getBadgePlacement(address);
    if (!placement) {
      return;
    }

    const colors = getRiskColors(score.risk);
    const badge = this.getRaydiumBadge(address) ?? createBadgeElement(address);
    badge.style.backgroundColor = colors.bg;
    badge.style.color = colors.text;
    badge.style.border = `1px solid ${colors.border}`;
    badge.style.boxShadow = colors.glow;
    setBadgeContent(badge, String(score.score));
    badge.title = `BarryGuard Score: ${score.score}/100 - Click for details`;
    badge.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      safeSendPopupMessage(this.buildSelectedToken(address, score));
    };

    renderBadgeTooltip(badge, score.score, score.risk, score.reasons ?? [], score.coverageRisk);

    this.insertRaydiumBadge(address, badge, placement);
  }

  override renderLoadingBadge(address: string): void {
    const placement = this.getBadgePlacement(address);
    if (!placement) {
      return;
    }

    const badge = this.getRaydiumBadge(address) ?? createBadgeElement(address);
    badge.style.backgroundColor = '#f3f4f6';
    badge.style.color = '#6b7280';
    badge.style.border = '1px solid #e5e7eb';
    setBadgeContent(badge, '...');
    badge.title = 'BarryGuard: Loading...';
    badge.onclick = null;

    this.insertRaydiumBadge(address, badge, placement);
  }

  override renderErrorBadge(address: string): void {
    const badge = this.getRaydiumBadge(address);
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

  override renderLockedBadge(address: string): void {
    const placement = this.getBadgePlacement(address);
    if (!placement) {
      return;
    }

    const badge = this.getRaydiumBadge(address) ?? createBadgeElement(address);
    badge.setAttribute('data-barryguard-locked', 'true');
    badge.style.backgroundColor = '#fef3c7';
    badge.style.color = '#92400e';
    badge.style.border = '1px solid #fde68a';
    setBadgeContent(badge, '\u{1F512}');
    badge.title = 'BarryGuard: Limit reached — upgrade or wait';
    badge.onclick = null;

    this.insertRaydiumBadge(address, badge, placement);
  }

  protected override findNameNode(root: Element): Element | null {
    const candidates = Array.from(root.querySelectorAll(
      '[data-sentry-element="Text"], p, span, div',
    ));

    const rankedCandidates = candidates.sort((left, right) => {
      const leftLeafScore = left.children.length === 0 ? 0 : 1;
      const rightLeafScore = right.children.length === 0 ? 0 : 1;
      if (leftLeafScore !== rightLeafScore) {
        return leftLeafScore - rightLeafScore;
      }

      const leftLength = (left.textContent?.trim().length ?? 0);
      const rightLength = (right.textContent?.trim().length ?? 0);
      return leftLength - rightLength;
    });

    for (const candidate of rankedCandidates) {
      if (candidate.closest('[data-barryguard="true"]')) {
        continue;
      }

      const text = candidate.textContent?.trim() ?? '';
      if (!this.isLikelyRaydiumTokenName(text)) {
        continue;
      }

      return candidate;
    }

    return super.findNameNode(root);
  }

  protected override findCardRoot(node: Element): Element | null {
    const selectors = [
      '[data-sentry-component="TopListCard"]',
      '[data-sentry-component="TopSpotCard"]',
      '[data-sentry-component="TokenCard"]',
      '[data-sentry-component="ListItem"]',
      '.ListItem',
      'article',
    ];

    for (const selector of selectors) {
      const match = node.closest(selector) ?? node.querySelector(selector);
      if (match && !match.closest('[data-barryguard="true"]')) {
        return match;
      }
    }

    return super.findCardRoot(node);
  }

  private findLaunchpadTokenName(): Element | null {
    const roots = Array.from(document.querySelectorAll(
      '[data-sentry-component="Info"], [data-sentry-source-file="Info.tsx"], [data-sentry-component="TokenDetail"]',
    ));

    for (const root of roots) {
      const candidates = Array.from(root.querySelectorAll(
        '[data-sentry-element="Text"], p, span, div',
      ));

      for (const candidate of this.rankTokenNameCandidates(candidates)) {
        if (candidate.closest('[data-barryguard="true"]')) {
          continue;
        }

        const text = candidate.textContent?.trim() ?? '';
        if (!this.isLikelyRaydiumTokenName(text)) {
          continue;
        }

        return candidate;
      }
    }

    return null;
  }

  private getBadgePlacement(address: string): { target: Element; mode: 'detail' | 'list' } | null {
    if (this.isCurrentTokenPage(address)) {
      const detailTarget = this.findDetailMarketCapTarget();
      return detailTarget ? { target: detailTarget, mode: 'detail' } : null;
    }

    const listTarget = this.findListMarketCapTarget(address);
    return listTarget ? { target: listTarget, mode: 'list' } : null;
  }

  private findDetailMarketCapTarget(): Element | null {
    const roots = Array.from(document.querySelectorAll(
      '[data-sentry-component="Info"], [data-sentry-source-file="Info.tsx"], [data-sentry-component="TokenDetail"]',
    ));

    for (const root of roots) {
      const candidates = Array.from(root.querySelectorAll('p, span, div'));
      for (const candidate of candidates) {
        const text = candidate.textContent?.trim() ?? '';
        if (/^Market cap:/i.test(text)) {
          return candidate;
        }
      }
    }

    return null;
  }

  private findListMarketCapTarget(address: string): Element | null {
    for (const node of this.getAddressNodes()) {
      const candidateAddress = this.extractAddressFromNode(node);
      if (candidateAddress !== address) {
        continue;
      }

      const cardRoot = this.findCardRoot(node) ?? node;
      const candidates = Array.from(cardRoot.querySelectorAll('p, span, div'));
      for (const candidate of candidates) {
        const text = candidate.textContent?.trim() ?? '';
        if (/^MC:\s*/i.test(text) || /^Market cap:/i.test(text)) {
          if ((candidate.tagName === 'P' || candidate.tagName === 'SPAN') && candidate.parentElement) {
            return candidate.parentElement;
          }

          return candidate;
        }
      }
    }

    return null;
  }

  private getRaydiumBadge(address: string): HTMLDivElement | null {
    return document.querySelector(`[data-barryguard-badge="${address}"]`);
  }

  private insertRaydiumBadge(
    address: string,
    badge: HTMLDivElement,
    placement: { target: Element; mode: 'detail' | 'list' },
  ): void {
    document
      .querySelectorAll(`[data-barryguard-context="raydium-${placement.mode}"]`)
      .forEach((element) => element.remove());

    badge.setAttribute('data-barryguard-context', `raydium-${placement.mode}`);

    if (placement.mode === 'detail') {
      badge.style.display = 'inline-flex';
      badge.style.marginLeft = '8px';
      badge.style.marginTop = '0';
      placement.target.insertAdjacentElement('afterend', badge);
      return;
    }

    badge.style.display = 'inline-flex';
    badge.style.marginLeft = '0';
    badge.style.marginTop = '0';
    badge.style.marginBottom = '4px';
    placement.target.insertAdjacentElement('beforebegin', badge);
  }

  private rankTokenNameCandidates(candidates: Element[]): Element[] {
    return candidates.sort((left, right) => {
      const leftLeafScore = left.children.length === 0 ? 0 : 1;
      const rightLeafScore = right.children.length === 0 ? 0 : 1;
      if (leftLeafScore !== rightLeafScore) {
        return leftLeafScore - rightLeafScore;
      }

      const leftLength = (left.textContent?.trim().length ?? 0);
      const rightLength = (right.textContent?.trim().length ?? 0);
      return leftLength - rightLength;
    });
  }

  private isLikelyRaydiumTokenName(value: string): boolean {
    if (!value || value.length < 2 || value.length > 48) {
      return false;
    }

    const normalized = value.trim().toLowerCase();
    if (
      normalized.startsWith('(')
      || normalized.includes(':')
      || normalized.includes('market cap')
      || normalized.includes('created ')
      || normalized.includes('contract address')
      || normalized.includes('curve type')
      || normalized.includes('trade fee')
      || normalized.includes('platform')
      || normalized.includes('quote token')
      || normalized.includes('tokens vesting')
      || normalized.includes('bonding curve')
      || normalized.includes('this token is')
      || normalized.includes('comments')
      || normalized.includes('transactions')
      || normalized.includes('holders')
      || normalized.includes('new token created')
      || normalized.includes('watch list')
      || normalized.includes('graduated')
      || normalized.includes('hot')
      || normalized.includes('buy')
      || normalized.includes('sell')
      || normalized.includes('connect wallet')
    ) {
      return false;
    }

    return true;
  }
}
