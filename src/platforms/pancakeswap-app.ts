import { GenericEvmPlatform } from './generic-evm';

export class PancakeSwapPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/(?:tokens|info\/tokens)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'pancakeswap',
      name: 'PancakeSwap',
      hostPattern: ['*://pancakeswap.finance/*', '*://www.pancakeswap.finance/*'],
      hostnames: ['pancakeswap.finance', 'www.pancakeswap.finance'],
      chain: 'bsc',
      chains: ['bsc', 'base'],
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
    return 'bsc';
  }
}
