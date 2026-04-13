import { GenericEvmPlatform } from './generic-evm';

export class MatchaPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/tokens\/(?:ethereum|bsc|base)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'matcha',
      name: 'Matcha',
      hostPattern: ['*://matcha.xyz/*', '*://www.matcha.xyz/*'],
      hostnames: ['matcha.xyz', 'www.matcha.xyz'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressPatterns: [tokenAddressPattern],
      linkAddressPatterns: [tokenAddressPattern],
      anchorSelectors: [
        'a[href*="/tokens/"]',
        '[data-testid*="token"]',
      ],
      compactBadge: true,
    });
  }

  override detectChainFromUrl(url: string): string | null {
    const match = url.match(/\/tokens\/(ethereum|bsc|base)\//i);
    if (match) return match[1].toLowerCase();
    return null;
  }
}
