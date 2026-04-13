import { GenericEvmPlatform } from './generic-evm';

export class BaseSwapPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenPathPattern = /\/info\/token\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'baseswap',
      name: 'BaseSwap',
      hostPattern: ['*://baseswap.fi/*', '*://www.baseswap.fi/*'],
      hostnames: ['baseswap.fi', 'www.baseswap.fi'],
      chain: 'base',
      chains: ['base'],
      currentAddressPatterns: [
        // /info/token/{address}
        tokenPathPattern,
        // /swap?outputCurrency={address}
        /[?&]outputCurrency=(0x[0-9a-fA-F]{40})/i,
        // generic token/address query params as fallback
        /[?&](?:inputCurrency|token|address)=(0x[0-9a-fA-F]{40})/i,
      ],
      linkAddressPatterns: [
        tokenPathPattern,
        /[?&]outputCurrency=(0x[0-9a-fA-F]{40})/i,
        /[?&](?:inputCurrency|token|address)=(0x[0-9a-fA-F]{40})/i,
      ],
      anchorSelectors: [
        'a[href*="/info/token/"]',
        'a[href*="outputCurrency="]',
        '[data-token-address]',
        '[data-testid*="token"]',
      ],
      compactBadge: true,
    });
  }
}
