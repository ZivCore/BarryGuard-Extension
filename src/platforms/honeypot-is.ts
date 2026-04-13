import { GenericEvmPlatform } from './generic-evm';

const CHAIN_SLUG_MAP: Record<string, string> = {
  ethereum: 'ethereum',
  bsc: 'bsc',
  base: 'base',
};

function extractHoneypotIsAddress(location: Location): string | null {
  // ?address=0x...&chain={slug}
  const params = new URLSearchParams(location.search);
  const address = params.get('address');
  const chainSlug = params.get('chain');

  if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) {
    return null;
  }
  if (!chainSlug) {
    return null;
  }
  const chain = CHAIN_SLUG_MAP[chainSlug.toLowerCase()];
  if (!chain) {
    return null;
  }
  return address;
}

export class HoneypotIsPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'honeypot-is',
      name: 'Honeypot.is',
      hostPattern: ['*://honeypot.is/*', '*://www.honeypot.is/*'],
      hostnames: ['honeypot.is', 'www.honeypot.is'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressExtractor: extractHoneypotIsAddress,
      anchorSelectors: ['a[href]', '[data-address]'],
      compactBadge: true,
    });
  }
}
