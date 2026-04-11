import { GenericEvmPlatform } from './generic-evm';

export class AerodromePlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/(?:tokens|info\/tokens)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'aerodrome',
      name: 'Aerodrome',
      hostPattern: ['*://aerodrome.finance/*', '*://www.aerodrome.finance/*'],
      hostnames: ['aerodrome.finance', 'www.aerodrome.finance'],
      chain: 'base',
      chains: ['base'],
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
}
