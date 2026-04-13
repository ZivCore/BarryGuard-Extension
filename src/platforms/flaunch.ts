import { GenericEvmPlatform } from './generic-evm';

export class FlaunchPlatform extends GenericEvmPlatform {
  constructor() {
    const coinPathPattern = /\/base\/coin\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'flaunch',
      name: 'flaunch',
      hostPattern: ['*://flaunch.gg/*', '*://www.flaunch.gg/*'],
      hostnames: ['flaunch.gg', 'www.flaunch.gg'],
      chain: 'base',
      chains: ['base'],
      currentAddressPatterns: [coinPathPattern],
      linkAddressPatterns: [coinPathPattern],
      anchorSelectors: [
        'a[href*="/base/coin/"]',
        '[data-token-address]',
        '[data-testid*="token"]',
      ],
      compactBadge: true,
    });
  }
}
