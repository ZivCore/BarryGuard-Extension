import { GenericEvmPlatform } from './generic-evm';

export class BscscanPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/token\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'bscscan',
      name: 'BscScan',
      hostPattern: ['*://bscscan.com/*', '*://www.bscscan.com/*'],
      hostnames: ['bscscan.com', 'www.bscscan.com'],
      chain: 'bsc',
      chains: ['bsc'],
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
