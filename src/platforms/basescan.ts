import { GenericEvmPlatform } from './generic-evm';

export class BasescanPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/token\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'basescan',
      name: 'Basescan',
      hostPattern: ['*://basescan.org/*', '*://www.basescan.org/*'],
      hostnames: ['basescan.org', 'www.basescan.org'],
      chain: 'base',
      chains: ['base'],
      currentAddressPatterns: [
        tokenAddressPattern,
      ],
      linkAddressPatterns: [
        tokenAddressPattern,
      ],
      anchorSelectors: [
        'a[href*="/token/"]',
        '[data-token-address]',
      ],
      compactBadge: true,
    });
  }
}
