import { GenericEvmPlatform } from './generic-evm';

const CHAIN_SLUG_MAP: Record<string, string> = {
  eth: 'ethereum',
  bsc: 'bsc',
  base: 'base',
};

function extractTokenSnifferAddress(location: Location): string | null {
  // /token/{chainSlug}/{address}
  const match = location.pathname.match(/^\/token\/([^/]+)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
  if (!match) {
    return null;
  }
  const chain = CHAIN_SLUG_MAP[match[1].toLowerCase()];
  if (!chain) {
    return null;
  }
  return match[2];
}

export class TokenSnifferPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'tokensniffer',
      name: 'TokenSniffer',
      hostPattern: ['*://tokensniffer.com/*', '*://www.tokensniffer.com/*'],
      hostnames: ['tokensniffer.com', 'www.tokensniffer.com'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressExtractor: extractTokenSnifferAddress,
      anchorSelectors: ['a[href]', '[data-address]'],
      compactBadge: true,
    });
  }
}
