import type { IPlatform } from './platform.interface';
import { createBadgeElement, getRiskColors, renderBadgeTooltip, safeSendPopupMessage, setBadgeContent } from './platform-utils';
import { dedupeAddresses } from './address-helpers';
import type { SelectedToken, TokenMetadata, TokenScore } from '../shared/types';

const EVM_ADDRESS_RE = /0x[0-9a-fA-F]{40}/g;

function extractEvmAddresses(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value.match(EVM_ADDRESS_RE) ?? [];
}

export function extractFirstEvmAddress(value: string | null | undefined): string | null {
  return extractEvmAddresses(value)[0] ?? null;
}

const DEFAULT_DETAIL_TARGET_SELECTORS = ['h1', 'h2', '[data-token-name]', '[class*="token"] [class*="name"]'];
const DEFAULT_CARD_CONTAINER_SELECTORS = [
  '[data-address]',
  '[data-token-address]',
  '[data-pair-address]',
  '[data-testid*="token"]',
  '[data-testid*="pair"]',
  '[class*="card"]',
  '[class*="row"]',
  '[class*="item"]',
  '[class*="token"]',
  '[class*="pair"]',
];
const DEFAULT_NAME_SELECTORS = [
  '[data-token-name]',
  '[data-testid*="name"]',
  '[class*="token-name"]',
  '[class*="pair-name"]',
  '[class*="name"]',
  'h1',
  'h2',
  'h3',
  'strong',
];
const DEFAULT_SYMBOL_SELECTORS = [
  '[data-token-symbol]',
  '[data-testid*="symbol"]',
  '[class*="symbol"]',
  '[class*="ticker"]',
  '[class*="pair-symbol"]',
  'span',
  'p',
];
const DEFAULT_IMAGE_SELECTORS = [
  'img[data-token-image]',
  'img[alt*="logo" i]',
  'img[alt*="token" i]',
  'img',
];
const DEFAULT_ANCHOR_SELECTORS = ['a[href]', '[data-address]', '[data-token-address]'];

type AddressExtractor = (location: Location) => string | null;

export interface GenericEvmPlatformConfig {
  id: string;
  name: string;
  hostPattern: string[];
  hostnames: string[];
  chain: string;
  chains?: string[];
  currentAddressPatterns?: RegExp[];
  currentAddressExtractor?: AddressExtractor;
  linkAddressPatterns?: RegExp[];
  detailTargetSelectors?: string[];
  cardContainerSelectors?: string[];
  nameSelectors?: string[];
  symbolSelectors?: string[];
  imageSelectors?: string[];
  anchorSelectors?: string[];
  compactBadge?: boolean;
}

export class GenericEvmPlatform implements IPlatform {
  readonly id: string;
  readonly name: string;
  readonly hostPattern: string[];
  readonly chains?: string[];

  protected readonly chain: string;
  private readonly hostnames: string[];
  private readonly currentAddressPatterns: RegExp[];
  private readonly currentAddressExtractor?: AddressExtractor;
  private readonly linkAddressPatterns: RegExp[];
  private readonly detailTargetSelectors: string[];
  private readonly cardContainerSelectors: string[];
  private readonly nameSelectors: string[];
  private readonly symbolSelectors: string[];
  private readonly imageSelectors: string[];
  private readonly anchorSelectors: string[];
  private readonly compactBadge: boolean;

  constructor(config: GenericEvmPlatformConfig) {
    this.id = config.id;
    this.name = config.name;
    this.hostPattern = config.hostPattern;
    this.hostnames = config.hostnames;
    this.chain = config.chain;
    this.chains = config.chains ?? [config.chain];
    this.currentAddressPatterns = config.currentAddressPatterns ?? [];
    this.currentAddressExtractor = config.currentAddressExtractor;
    this.linkAddressPatterns = config.linkAddressPatterns ?? [];
    this.detailTargetSelectors = config.detailTargetSelectors ?? DEFAULT_DETAIL_TARGET_SELECTORS;
    this.cardContainerSelectors = config.cardContainerSelectors ?? DEFAULT_CARD_CONTAINER_SELECTORS;
    this.nameSelectors = config.nameSelectors ?? DEFAULT_NAME_SELECTORS;
    this.symbolSelectors = config.symbolSelectors ?? DEFAULT_SYMBOL_SELECTORS;
    this.imageSelectors = config.imageSelectors ?? DEFAULT_IMAGE_SELECTORS;
    this.anchorSelectors = config.anchorSelectors ?? DEFAULT_ANCHOR_SELECTORS;
    this.compactBadge = config.compactBadge ?? false;
  }

  matchesLocation(location: Location): boolean {
    return this.hostnames.some((hostname) => location.hostname === hostname || location.hostname.endsWith(`.${hostname}`));
  }

  getCurrentPageAddress(): string | null {
    if (this.currentAddressExtractor) {
      const extracted = this.currentAddressExtractor(window.location);
      if (extracted) {
        return extracted;
      }
    }

    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    for (const pattern of this.currentAddressPatterns) {
      const match = currentUrl.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return null;
  }

  extractTokenAddresses(): string[] {
    const addresses: string[] = [];
    const currentAddress = this.getCurrentPageAddress();
    if (currentAddress) {
      addresses.push(currentAddress);
    }

    for (const node of this.getAddressNodes()) {
      const address = this.extractAddressFromNode(node);
      if (address) {
        addresses.push(address);
      }
    }

    return dedupeAddresses(addresses);
  }

  buildSelectedToken(address: string, score: TokenScore): SelectedToken {
    const metadataRoot = this.isCurrentTokenPage(address)
      ? document
      : this.findListContext(address) ?? document;

    return {
      address,
      score,
      metadata: this.extractTokenMetadata(metadataRoot),
    };
  }

  renderScoreBadge(address: string, score: TokenScore): void {
    const target = this.getTargetElement(address);
    if (!target) {
      return;
    }

    const colors = getRiskColors(score.risk);
    const existingBadge = this.getBadge(address);
    const badge = existingBadge ?? createBadgeElement(address);
    badge.removeAttribute('data-barryguard-locked');
    badge.style.backgroundColor = colors.bg;
    badge.style.color = colors.text;
    badge.style.border = `1px solid ${colors.border}`;
    badge.style.boxShadow = colors.glow;
    setBadgeContent(badge, String(score.score), this.compactBadge);
    badge.title = `BarryGuard Score: ${score.score}/100 - Click for details`;
    badge.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      safeSendPopupMessage(this.buildSelectedToken(address, score));
    };

    renderBadgeTooltip(badge, score.score, score.risk, score.reasons ?? [], score.coverageRisk);

    if (!existingBadge || this.shouldReinsertBadge(address, existingBadge)) {
      this.insertBadge(address, target, badge);
    }
  }

  renderLoadingBadge(address: string): void {
    const existingBadge = this.getBadge(address);

    if (existingBadge && existingBadge.getAttribute('data-barryguard-locked') === 'true') {
      return;
    }
    if (existingBadge && existingBadge.getAttribute('data-bg-score')) {
      return;
    }

    const target = this.getTargetElement(address);
    if (!target) {
      return;
    }

    const badge = existingBadge ?? createBadgeElement(address);
    badge.style.backgroundColor = '#f3f4f6';
    badge.style.color = '#6b7280';
    badge.style.border = '1px solid #e5e7eb';
    setBadgeContent(badge, '...', this.compactBadge);
    badge.title = 'BarryGuard: Loading...';
    badge.onclick = null;

    if (!existingBadge || this.shouldReinsertBadge(address, existingBadge)) {
      this.insertBadge(address, target, badge);
    }
  }

  renderErrorBadge(address: string): void {
    const badge = this.getBadge(address);
    if (!badge) {
      return;
    }

    setBadgeContent(badge, '?', this.compactBadge);
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
    const badge = existingBadge ?? createBadgeElement(address);
    badge.setAttribute('data-barryguard-locked', 'true');
    badge.style.backgroundColor = '#fef3c7';
    badge.style.color = '#92400e';
    badge.style.border = '1px solid #fde68a';
    setBadgeContent(badge, '\u{1F512}', this.compactBadge);
    badge.title = 'BarryGuard: Limit reached — upgrade or wait';
    badge.onclick = null;

    if (!existingBadge || this.shouldReinsertBadge(address, existingBadge)) {
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
            return this.detailTargetSelectors.some((selector) => element.matches(selector) || !!element.querySelector(selector))
              || element.matches('h1, h2, main')
              || !!element.querySelector('h1, h2, main');
          }

          return this.anchorSelectors.some((selector) => element.matches(selector) || !!element.querySelector(selector));
        }));

      if (hasRelevantNodes) {
        setTimeout(callback, 100);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  detectChainFromUrl(url: string): string | null {
    const chainPatterns: Array<[RegExp, string]> = [
      [/\/(?:ethereum|eth)(?:\/|$)/i, 'ethereum'],
      [/\/(?:bsc|bnb|binance)(?:\/|$)/i, 'bsc'],
      [/\/(?:base)(?:\/|$)/i, 'base'],
      [/\/(?:solana|sol)(?:\/|$)/i, 'solana'],
    ];

    for (const [pattern, chain] of chainPatterns) {
      if (pattern.test(url)) {
        return chain;
      }
    }

    return this.chains?.[0] ?? this.chain ?? null;
  }

  protected isCurrentTokenPage(address: string): boolean {
    return this.getCurrentPageAddress() === address;
  }

  protected extractAddressFromNode(node: Element): string | null {
    const href = node.getAttribute('href') ?? '';
    if (href && /\/(?:account|address)\/0x[0-9a-fA-F]{40}/.test(href)) {
      return null;
    }

    const hrefLikeValues = [
      node.getAttribute('href'),
      node.getAttribute('data-address'),
      node.getAttribute('data-token-address'),
      node.getAttribute('data-pair-base-token'),
      node.getAttribute('data-base-token'),
      node.textContent,
    ];

    for (const value of hrefLikeValues) {
      const fromPattern = this.extractAddressFromText(value);
      if (fromPattern) {
        return fromPattern;
      }
    }

    if (node instanceof HTMLAnchorElement) {
      return this.extractAddressFromText(node.href);
    }

    return null;
  }

  protected extractAddressFromText(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    for (const pattern of this.linkAddressPatterns) {
      const match = value.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }

    return extractFirstEvmAddress(value);
  }

  protected getAddressNodes(): Element[] {
    const nodes = new Set<Element>();
    for (const selector of this.anchorSelectors) {
      document.querySelectorAll(selector).forEach((node) => nodes.add(node));
    }

    return [...nodes];
  }

  protected getTargetElement(address: string): Element | null {
    if (this.isCurrentTokenPage(address)) {
      return this.getDetailTarget();
    }

    return this.findListContext(address);
  }

  protected getDetailTarget(): Element | null {
    for (const selector of this.detailTargetSelectors) {
      const match = document.querySelector(selector);
      if (match && !match.closest('[data-barryguard="true"]')) {
        return match;
      }
    }

    const currentAddress = this.getCurrentPageAddress();
    const fallback = document.querySelector('main') ?? document.body;
    if (!fallback) {
      return null;
    }

    if (!currentAddress) {
      return fallback;
    }

    const fallbackText = fallback.textContent ?? '';
    return fallbackText.includes(currentAddress) ? fallback : null;
  }

  protected findListContext(address: string): Element | null {
    for (const node of this.getAddressNodes()) {
      const candidateAddress = this.extractAddressFromNode(node);
      if (candidateAddress !== address) {
        continue;
      }

      const cardRoot = this.findCardRoot(node);
      const nameNode = this.findNameNode(cardRoot ?? node);
      if (nameNode) {
        return nameNode;
      }

      return cardRoot ?? node;
    }

    return null;
  }

  protected findCardRoot(node: Element): Element | null {
    for (const selector of this.cardContainerSelectors) {
      const match = node.closest(selector) ?? node.querySelector(selector);
      if (match && !match.closest('[data-barryguard="true"]')) {
        return match;
      }
    }

    return node;
  }

  protected findNameNode(root: Element): Element | null {
    for (const selector of this.nameSelectors) {
      const matches = Array.from(root.querySelectorAll(selector));
      for (const match of matches) {
        if (match.closest('[data-barryguard="true"]')) {
          continue;
        }

        const value = match.textContent?.trim();
        if (value && value.length > 2 && value.length < 80) {
          return match;
        }
      }
    }

    return null;
  }

  protected extractTokenMetadata(root: Element | Document): TokenMetadata {
    const scopedRoot = root instanceof Document ? root.documentElement : root;
    return {
      name: this.findText(scopedRoot, this.nameSelectors, (value) => value.length > 2 && value.length < 80),
      symbol: this.findText(
        scopedRoot,
        this.symbolSelectors,
        (value) => /^\$?[A-Z0-9_]{2,16}$/.test(value),
      ),
      imageUrl: this.findImage(scopedRoot),
    };
  }

  protected findText(root: Element, selectors: string[], isValid: (value: string) => boolean): string | undefined {
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

  protected findImage(root: Element): string | undefined {
    for (const selector of this.imageSelectors) {
      const match = root.querySelector<HTMLImageElement>(selector);
      const src = match?.getAttribute('src');
      if (src) {
        return match?.src ?? src;
      }
    }

    return undefined;
  }

  protected getBadgeContext(address: string): string {
    return this.isCurrentTokenPage(address) ? `${this.id}-detail` : `${this.id}-list`;
  }

  private getBadge(address: string): HTMLDivElement | null {
    return document.querySelector(`[data-barryguard-badge="${address}"]`);
  }

  private shouldReinsertBadge(address: string, badge: HTMLDivElement): boolean {
    return badge.getAttribute('data-barryguard-context') !== this.getBadgeContext(address);
  }

  protected insertBadge(address: string, target: Element, badge: HTMLDivElement): void {
    if (this.isCurrentTokenPage(address)) {
      document
        .querySelectorAll(`[data-barryguard-context="${this.id}-detail"]`)
        .forEach((element) => element.remove());
      badge.setAttribute('data-barryguard-context', `${this.id}-detail`);
      badge.style.marginLeft = '0';
      badge.style.marginTop = '8px';
      target.insertAdjacentElement('afterend', badge);
      return;
    }

    badge.setAttribute('data-barryguard-context', `${this.id}-list`);
    badge.style.marginLeft = '0';
    badge.style.marginTop = '4px';
    badge.style.display = 'flex';
    target.insertAdjacentElement('afterend', badge);
  }
}
