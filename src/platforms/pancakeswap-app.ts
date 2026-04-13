import { GenericEvmPlatform } from './generic-evm';

// Query param chain slugs → internal chain id
const QUERY_CHAIN_MAP: Record<string, string> = {
  'eth': 'ethereum',
  'ethereum': 'ethereum',
  'base': 'base',
  'bnb': 'bsc',
  'bsc': 'bsc',
};

// Path chain slugs → internal chain id  (e.g. /info/ethereum/tokens/0x...)
const PATH_CHAIN_MAP: Record<string, string> = {
  'eth': 'ethereum',
  'ethereum': 'ethereum',
  'base': 'base',
  'bsc': 'bsc',
  'bnb': 'bsc',
};

export class PancakeSwapPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern =
      /\/(?:(?:[a-z]+)\/)?(?:tokens|info\/(?:[a-z]+\/)?tokens)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'pancakeswap',
      name: 'PancakeSwap',
      hostPattern: ['*://pancakeswap.finance/*', '*://www.pancakeswap.finance/*'],
      hostnames: ['pancakeswap.finance', 'www.pancakeswap.finance'],
      chain: 'bsc',
      chains: ['bsc', 'ethereum', 'base'],
      currentAddressPatterns: [
        tokenAddressPattern,
        /[?&](?:token|address)=(0x[0-9a-fA-F]{40})/i,
      ],
      linkAddressPatterns: [
        tokenAddressPattern,
        /[?&](?:token|address)=(0x[0-9a-fA-F]{40})/i,
      ],
      anchorSelectors: [
        'a[href*="/tokens/"]',
        'a[href*="/info/tokens/"]',
        'a[href*="/info/ethereum/"]',
        'a[href*="/info/base/"]',
        '[data-testid*="token"]',
        '[data-token-address]',
      ],
      compactBadge: true,
    });
  }

  override detectChainFromUrl(url: string): string | null {
    // 1. Query param: ?chain=eth / ?chain=base / ?chain=bnb
    const queryMatch = /[?&]chain=([^&#]+)/i.exec(url);
    if (queryMatch) {
      const slug = queryMatch[1].toLowerCase();
      return QUERY_CHAIN_MAP[slug] ?? null;
    }

    // 2. Path segment: /info/{chainSlug}/tokens/0x...
    const pathMatch = /\/info\/([a-z]+)\/(?:tokens\/)?0x[0-9a-fA-F]{40}/i.exec(url);
    if (pathMatch) {
      const slug = pathMatch[1].toLowerCase();
      return PATH_CHAIN_MAP[slug] ?? null;
    }

    // 3. Bare /base/ path segment (legacy pattern kept for backward compat)
    if (/\/base(?:\/|$)/i.test(url)) {
      return 'base';
    }

    // 4. No unambiguous chain indicator → null (ADR-007)
    return null;
  }
}
