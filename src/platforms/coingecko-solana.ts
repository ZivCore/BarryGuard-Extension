import { GenericSolanaPlatform } from './generic-solana';

const LOCALE_PREFIX_RE = /^\/[a-z]{2}(?:-[a-z]{2})?\//i;

// DOM label text → internal chain id for the /coins/{slug} page
const DOM_CHAIN_LABEL_MAP: Record<string, string> = {
  'ethereum': 'ethereum',
  'bnb smart chain': 'bsc',
  'base': 'base',
  'solana': 'solana',
};

// Selectors where CoinGecko renders the contract/chain block on coin pages
const CONTRACT_CHAIN_SELECTORS = [
  '[data-view-component="true"] span',
  '[class*="ContractAddress"] span',
  '[class*="contract"] span',
  'span',
];

function extractEvmAddressFromText(text: string): string | null {
  const match = /(0x[0-9a-fA-F]{40})/.exec(text);
  return match ? match[1] : null;
}

export class CoinGeckoSolanaPlatform extends GenericSolanaPlatform {
  readonly chains = ['solana', 'ethereum', 'bsc', 'base'];

  constructor() {
    super({
      id: 'coingecko-solana',
      name: 'CoinGecko (Solana)',
      hostPattern: ['*://www.coingecko.com/*'],
      hostnames: ['www.coingecko.com'],
      // CoinGecko chain pages rarely embed mint addresses in the URL. We rely on
      // explorer links (Solscan/Birdeye) present in the DOM.
      currentAddressPatterns: [
        /solscan\.io\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i,
        /birdeye\.so\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i,
        /birdeye\.so\/[a-z0-9_-]+\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      linkAddressPatterns: [
        /solscan\.io\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i,
        /birdeye\.so\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i,
        /birdeye\.so\/[a-z0-9_-]+\/token\/([1-9A-HJ-NP-Za-km-z]{32,44})/i,
      ],
      anchorSelectors: [
        'a[href*="solscan.io/token/"]',
        'a[href*="birdeye.so/token/"]',
        '[data-token-address]',
        '[data-address]',
      ],
      detailTargetSelectors: [
        'main h1',
        'main h2',
        'h1',
        'h2',
      ],
      compactBadge: true,
    });
  }

  detectChainFromUrl(url: string): string | null {
    const chainPatterns: Array<[RegExp, string]> = [
      [/\/chains\/solana(?:\/|$)/i, 'solana'],
      [/\/chains\/ethereum(?:\/|$)/i, 'ethereum'],
      [/\/chains\/bsc(?:\/|$)/i, 'bsc'],
      [/\/chains\/base(?:\/|$)/i, 'base'],
    ];

    for (const [pattern, chain] of chainPatterns) {
      if (pattern.test(url)) {
        return chain;
      }
    }

    return 'solana';
  }

  override matchesLocation(location: Location): boolean {
    if (!super.matchesLocation(location)) {
      return false;
    }

    const path = location.pathname ?? '/';
    const normalized = path.replace(LOCALE_PREFIX_RE, '/');

    // /chains/solana/... (existing Solana path)
    if (/^\/chains\/solana(?:\/|$)/i.test(normalized)) {
      return true;
    }

    // /coins/{slug} — EVM coin detail pages
    if (/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?coins\/[^/]+(?:\/|$)/i.test(path)) {
      return true;
    }

    return false;
  }

  /**
   * On /coins/{slug} pages, try to read the EVM contract address from the DOM
   * contract block. Falls back to the Solana address extractor for Solana tokens
   * or when the chain cannot be determined from the DOM.
   */
  override getCurrentPageAddress(): string | null {
    const path = window.location?.pathname ?? '';
    const normalized = path.replace(LOCALE_PREFIX_RE, '/');
    const isCoinPage = /^\/coins\/[^/]+(?:\/|$)/i.test(normalized);

    if (isCoinPage) {
      const evmResult = this.extractEvmAddressFromCoinPage();
      if (evmResult) {
        return evmResult;
      }
    }

    // Default: Solana extraction via URL patterns
    return super.getCurrentPageAddress();
  }

  /**
   * Reads chain label and EVM contract address from the CoinGecko coin-detail DOM.
   * Returns null when chain is unrecognised or no EVM address is found — this
   * ensures unknown chains never produce false positives (ADR-007).
   */
  private extractEvmAddressFromCoinPage(): string | null {
    // Look for spans that contain an EVM address near a chain label
    const spans = Array.from(document.querySelectorAll<HTMLElement>(
      CONTRACT_CHAIN_SELECTORS.join(', '),
    ));

    for (const span of spans) {
      const text = span.textContent?.trim() ?? '';
      const evmAddress = extractEvmAddressFromText(text);
      if (evmAddress) {
        // Walk up siblings/parents to find a chain label
        const chain = this.findChainLabelNear(span);
        if (chain && chain !== 'solana') {
          return evmAddress;
        }
      }
    }

    return null;
  }

  private findChainLabelNear(el: HTMLElement): string | null {
    // Search the nearest container block for a recognisable chain label text
    const container = el.closest('[class*="contract"], [class*="Contract"], [class*="chain"], section, article, div') ?? el.parentElement;
    if (!container) {
      return null;
    }

    const containerText = container.textContent?.toLowerCase() ?? '';
    for (const [label, chain] of Object.entries(DOM_CHAIN_LABEL_MAP)) {
      if (containerText.includes(label)) {
        return chain;
      }
    }

    return null;
  }
}

