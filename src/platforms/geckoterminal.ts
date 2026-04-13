import { GenericEvmPlatform } from './generic-evm';

const CHAIN_SLUG_MAP: Record<string, string> = {
  eth: 'ethereum',
  bsc: 'bsc',
  base: 'base',
};

function extractGeckoTerminalAddress(location: Location): string | null {
  // /{chainSlug}/(pools|tokens)/{address}
  const match = location.pathname.match(/^\/([^/]+)\/(?:pools|tokens)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
  if (!match) {
    return null;
  }
  const chain = CHAIN_SLUG_MAP[match[1].toLowerCase()];
  if (!chain) {
    return null;
  }
  return match[2];
}

export class GeckoTerminalPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'geckoterminal',
      name: 'GeckoTerminal',
      hostPattern: ['*://geckoterminal.com/*', '*://www.geckoterminal.com/*'],
      hostnames: ['geckoterminal.com', 'www.geckoterminal.com'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressExtractor: extractGeckoTerminalAddress,
      anchorSelectors: ['a[href]', '[data-address]'],
      compactBadge: true,
    });
  }
}
