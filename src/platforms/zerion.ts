import { GenericEvmPlatform } from './generic-evm';

const CHAIN_SLUG_TO_CHAIN: Record<string, string> = {
  'ethereum': 'ethereum',
  'bsc': 'bsc',
  'base': 'base',
};

export class ZerionPlatform extends GenericEvmPlatform {
  constructor() {
    // /tokens/{address}-{chainSlug}  e.g. /tokens/0xabc...-ethereum
    const tokenAddressPattern =
      /\/tokens\/(0x[0-9a-fA-F]{40})-(?:ethereum|bsc|base)(?:[/?#]|$)/i;

    super({
      id: 'zerion',
      name: 'Zerion',
      hostPattern: [
        '*://app.zerion.io/*',
        '*://zerion.io/*',
        '*://www.zerion.io/*',
      ],
      hostnames: ['app.zerion.io', 'zerion.io', 'www.zerion.io'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressPatterns: [tokenAddressPattern],
      linkAddressPatterns: [tokenAddressPattern],
      anchorSelectors: [
        'a[href*="/tokens/"]',
        '[data-token-address]',
      ],
      compactBadge: true,
    });
  }

  override detectChainFromUrl(url: string): string | null {
    const match = /\/tokens\/0x[0-9a-fA-F]{40}-(ethereum|bsc|base)(?:[/?#]|$)/i.exec(url);
    if (match) {
      return CHAIN_SLUG_TO_CHAIN[match[1].toLowerCase()] ?? null;
    }

    return null;
  }
}
