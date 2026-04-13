import { GenericEvmPlatform } from './generic-evm';

const CHAIN_SLUG_MAP: Record<string, string> = {
  eth: 'ethereum',
  bsc: 'bsc',
  base: 'base',
};

export class GmgnEvmPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'gmgn-evm',
      name: 'GMGN',
      hostPattern: ['*://gmgn.ai/*', '*://www.gmgn.ai/*'],
      hostnames: ['gmgn.ai', 'www.gmgn.ai'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressExtractor: (location) => {
        // Pattern: /{chainSlug}/token/{address}
        // Ignore Solana paths (/sol/...)
        const match = location.pathname.match(/^\/([^/]+)\/token\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
        if (!match) {
          return null;
        }
        const slug = match[1].toLowerCase();
        if (!(slug in CHAIN_SLUG_MAP)) {
          return null;
        }
        return match[2];
      },
      linkAddressPatterns: [
        /\/(?:eth|bsc|base)\/token\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i,
      ],
      anchorSelectors: ['a[href*="/token/"]', '[data-token-address]'],
      compactBadge: true,
    });
  }

  override detectChainFromUrl(url: string): string | null {
    const match = url.match(/\/([^/]+)\/token\/0x[0-9a-fA-F]{40}/i);
    if (match) {
      const slug = match[1].toLowerCase();
      if (slug in CHAIN_SLUG_MAP) {
        return CHAIN_SLUG_MAP[slug];
      }
    }
    return null;
  }
}
