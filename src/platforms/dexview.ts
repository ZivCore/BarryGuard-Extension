import { GenericEvmPlatform } from './generic-evm';

const CHAIN_SLUG_MAP: Record<string, string> = {
  bsc: 'bsc',
  ethereum: 'ethereum',
  base: 'base',
};

function extractDexViewAddress(location: Location): string | null {
  // /{chainSlug}/{address}
  const match = location.pathname.match(/^\/([^/]+)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i);
  if (!match) {
    return null;
  }
  const chain = CHAIN_SLUG_MAP[match[1].toLowerCase()];
  if (!chain) {
    return null;
  }
  return match[2];
}

export class DexViewPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'dexview',
      name: 'DexView',
      hostPattern: ['*://dexview.com/*', '*://www.dexview.com/*'],
      hostnames: ['dexview.com', 'www.dexview.com'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressExtractor: extractDexViewAddress,
      anchorSelectors: ['a[href]', '[data-address]'],
      compactBadge: true,
    });
  }
}
