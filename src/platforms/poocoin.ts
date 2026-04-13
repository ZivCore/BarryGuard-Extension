import { GenericEvmPlatform } from './generic-evm';

export class PoocoinPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/tokens\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'poocoin',
      name: 'Poocoin',
      hostPattern: ['*://poocoin.app/*', '*://www.poocoin.app/*'],
      hostnames: ['poocoin.app', 'www.poocoin.app'],
      chain: 'bsc',
      chains: ['bsc'],
      currentAddressPatterns: [tokenAddressPattern],
      linkAddressPatterns: [tokenAddressPattern],
      anchorSelectors: ['a[href*="/tokens/"]', '[data-token-address]'],
      compactBadge: true,
    });
  }
}
