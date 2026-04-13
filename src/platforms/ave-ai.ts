import { GenericEvmPlatform } from './generic-evm';

const CHAIN_SLUG_MAP: Record<string, string> = {
  eth: 'ethereum',
  bsc: 'bsc',
  base: 'base',
};

function extractAveAiAddress(location: Location): string | null {
  // /token/{address}-{chainSlug}
  const match = location.pathname.match(/^\/token\/(0x[0-9a-fA-F]{40})-([^/?#]+)(?:[/?#]|$)/i);
  if (!match) {
    return null;
  }
  const chain = CHAIN_SLUG_MAP[match[2].toLowerCase()];
  if (!chain) {
    return null;
  }
  return match[1];
}

export class AveAiPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'ave-ai',
      name: 'Ave.ai',
      hostPattern: ['*://ave.ai/*', '*://www.ave.ai/*'],
      hostnames: ['ave.ai', 'www.ave.ai'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressExtractor: extractAveAiAddress,
      anchorSelectors: ['a[href]', '[data-address]'],
      compactBadge: true,
    });
  }
}
