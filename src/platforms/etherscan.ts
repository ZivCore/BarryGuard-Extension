import { GenericEvmPlatform } from './generic-evm';

export class EtherscanPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/token\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'etherscan',
      name: 'Etherscan',
      hostPattern: ['*://etherscan.io/*', '*://www.etherscan.io/*'],
      hostnames: ['etherscan.io', 'www.etherscan.io'],
      chain: 'ethereum',
      chains: ['ethereum'],
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
