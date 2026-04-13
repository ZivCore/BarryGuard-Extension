import { GenericEvmPlatform } from './generic-evm';

const CHAIN_ID_MAP: Record<string, string> = {
  '1': 'ethereum',
  '56': 'bsc',
  '8453': 'base',
};

function extractGoPlusAddress(location: Location): string | null {
  // /token-security/{chainId}/{address}
  const match = location.pathname.match(/^\/token-security\/([^/]+)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
  if (!match) {
    return null;
  }
  const chain = CHAIN_ID_MAP[match[1]];
  if (!chain) {
    return null;
  }
  return match[2];
}

export class GoPlusPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'goplus',
      name: 'GoPlus',
      hostPattern: ['*://gopluslabs.io/*', '*://www.gopluslabs.io/*'],
      hostnames: ['gopluslabs.io', 'www.gopluslabs.io'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressExtractor: extractGoPlusAddress,
      anchorSelectors: ['a[href]', '[data-address]'],
      compactBadge: true,
    });
  }
}
