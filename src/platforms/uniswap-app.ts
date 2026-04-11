import { GenericEvmPlatform } from './generic-evm';

export class UniswapPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/tokens\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'uniswap',
      name: 'Uniswap',
      hostPattern: ['*://app.uniswap.org/*'],
      hostnames: ['app.uniswap.org'],
      chain: 'ethereum',
      chains: ['ethereum', 'base'],
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
        '[data-testid*="token"]',
        '[data-token-address]',
      ],
      compactBadge: true,
    });
  }

  override detectChainFromUrl(url: string): string | null {
    if (/\/base(?:\/|$)/i.test(url)) {
      return 'base';
    }
    return 'ethereum';
  }
}
