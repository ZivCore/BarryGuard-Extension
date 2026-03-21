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
    const heuristicTarget = this.findHeuristicDetailTarget();
    if (heuristicTarget) {
      return heuristicTarget;
    }

    return super.getDetailTarget();
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
      const matchingCandidates = candidates.filter((candidate) => this.matchesTitleTokenName(candidate, titleTokenName));
      const groupedTitleContainer = this.findGroupedTitleContainer(root, matchingCandidates, titleTokenName);
      if (groupedTitleContainer) {
        return groupedTitleContainer;
      }

      const preferredMatch = this.pickBestTokenNameCandidate(matchingCandidates, titleTokenName);
      if (preferredMatch) {
        return preferredMatch;
      }
    }

    return this.pickBestTokenNameCandidate(candidates);
  }

  private getTitleTokenName(): string | null {
    const rawTitle = document.title.trim();
    if (!rawTitle) {
      return null;
    }

    const primary = rawTitle.split('|')[0]?.trim() ?? rawTitle;
    const normalized = primary
      .replace(/\son bags$/i, '')
      .replace(/\s+\$[A-Z0-9_]{2,16}$/i, '')
      .replace(/\s*\([A-Z0-9_$]{2,20}\)\s*$/i, '')
      .trim();
    return this.isLikelyTokenName(normalized) ? normalized : null;
  }

  private matchesTitleTokenName(candidate: Element, titleTokenName: string): boolean {
    if (candidate.closest('[data-barryguard="true"]')) {
      return false;
    }

    const text = candidate.textContent?.trim() ?? '';
    if (!text) {
      return false;
    }

    const normalizedText = this.normalizeTokenNameText(text);
    const normalizedTitle = this.normalizeTokenNameText(titleTokenName);
    return normalizedText === normalizedTitle
      || normalizedText.includes(normalizedTitle)
      || normalizedTitle.includes(normalizedText);
  }

  private pickBestTokenNameCandidate(candidates: Element[], titleTokenName?: string): Element | null {
    const normalizedTitle = titleTokenName ? this.normalizeTokenNameText(titleTokenName) : null;
    const validCandidates = candidates.filter((candidate) => {
      if (candidate.closest('[data-barryguard="true"]')) {
        return false;
      }

      const text = candidate.textContent?.trim() ?? '';
      return this.isLikelyTokenName(text);
    });

    const rankedCandidates = validCandidates.sort((left, right) => {
      const leftText = left.textContent?.trim() ?? '';
      const rightText = right.textContent?.trim() ?? '';
      const leftNormalized = this.normalizeTokenNameText(leftText);
      const rightNormalized = this.normalizeTokenNameText(rightText);

      const leftExactScore = normalizedTitle && leftNormalized === normalizedTitle ? 0 : 1;
      const rightExactScore = normalizedTitle && rightNormalized === normalizedTitle ? 0 : 1;
      if (leftExactScore !== rightExactScore) {
        return leftExactScore - rightExactScore;
      }

      const leftLeafScore = left.children.length === 0 ? 0 : 1;
      const rightLeafScore = right.children.length === 0 ? 0 : 1;
      if (leftLeafScore !== rightLeafScore) {
        return leftLeafScore - rightLeafScore;
      }

      const leftSemanticScore = this.getTokenNameSemanticScore(left);
      const rightSemanticScore = this.getTokenNameSemanticScore(right);
      if (leftSemanticScore !== rightSemanticScore) {
        return leftSemanticScore - rightSemanticScore;
      }

      const leftInteractiveScore = left.querySelector('a, button') ? 1 : 0;
      const rightInteractiveScore = right.querySelector('a, button') ? 1 : 0;
      if (leftInteractiveScore !== rightInteractiveScore) {
        return leftInteractiveScore - rightInteractiveScore;
      }

      return leftText.length - rightText.length;
    });

    return rankedCandidates[0] ?? null;
  }

  private findGroupedTitleContainer(root: Element, candidates: Element[], titleTokenName: string): Element | null {
    const normalizedTitle = this.normalizeTokenNameText(titleTokenName);
    const exactLeafMatches = candidates.filter((candidate) => {
      const text = candidate.textContent?.trim() ?? '';
      return candidate.children.length === 0 && this.normalizeTokenNameText(text) === normalizedTitle;
    });

    const containerCandidates = exactLeafMatches
      .map((candidate) => candidate.parentElement)
      .filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement)
      .filter((candidate) =>
        candidate !== root
        && !candidate.closest('[data-barryguard="true"]')
        && !candidate.querySelector('a, button')
        && (candidate.textContent?.trim().length ?? 0) <= Math.max(titleTokenName.length * 3, 80),
      )
      .filter((candidate) => {
        const exactChildMatches = Array.from(candidate.children).filter((child) => {
          const text = child.textContent?.trim() ?? '';
          return this.normalizeTokenNameText(text) === normalizedTitle;
        });

        return exactChildMatches.length >= 2;
      });

    const rankedContainers = containerCandidates.sort((left, right) => {
      const leftLength = left.textContent?.trim().length ?? 0;
      const rightLength = right.textContent?.trim().length ?? 0;
      return leftLength - rightLength;
    });

    return rankedContainers[0] ?? null;
  }

  private normalizeTokenNameText(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private getTokenNameSemanticScore(candidate: Element): number {
    const signature = [
      candidate.tagName,
      candidate.getAttribute('class') ?? '',
      candidate.getAttribute('data-testid') ?? '',
    ].join(' ').toLowerCase();

    if (signature.includes('symbol')) {
      return 2;
    }

    if (signature.includes('title') || signature.includes('name') || /^h[1-3]$/.test(candidate.tagName.toLowerCase())) {
      return 0;
    }

    return 1;
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
