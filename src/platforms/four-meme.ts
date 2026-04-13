import { GenericEvmPlatform } from './generic-evm';

export class FourMemePlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/token\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'four-meme',
      name: 'four.meme',
      hostPattern: ['*://four.meme/*', '*://www.four.meme/*'],
      hostnames: ['four.meme', 'www.four.meme'],
      chain: 'bsc',
      chains: ['bsc'],
      currentAddressPatterns: [tokenAddressPattern],
      linkAddressPatterns: [tokenAddressPattern],
      anchorSelectors: ['a[href*="/token/"]', '[data-token-address]'],
      compactBadge: true,
    });
  }
}
