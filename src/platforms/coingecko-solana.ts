import { GenericSolanaPlatform } from './generic-solana';

const LOCALE_PREFIX_RE = /^\/[a-z]{2}(?:-[a-z]{2})?\//i;

export class CoinGeckoSolanaPlatform extends GenericSolanaPlatform {
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

  override matchesLocation(location: Location): boolean {
    if (!super.matchesLocation(location)) {
      return false;
    }

    // Locale-independent: allow `/chains/solana/...` and `/{locale}/chains/solana/...`
    const path = location.pathname ?? '/';
    const normalized = path.replace(LOCALE_PREFIX_RE, '/');
    return /^\/chains\/solana(?:\/|$)/i.test(normalized);
  }
}

