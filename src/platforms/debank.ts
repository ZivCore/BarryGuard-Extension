import { GenericEvmPlatform } from './generic-evm';

const CHAIN_ID_TO_CHAIN: Record<string, string> = {
  '1': 'ethereum',
  '56': 'bsc',
  '8453': 'base',
};

export class DeBankPlatform extends GenericEvmPlatform {
  constructor() {
    const tokenAddressPattern = /\/tokens\/(?:1|56|8453)\/(0x[0-9a-fA-F]{40})(?:[/?#]|$)/i;

    super({
      id: 'debank',
      name: 'DeBank',
      hostPattern: ['*://debank.com/*', '*://www.debank.com/*'],
      hostnames: ['debank.com', 'www.debank.com'],
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
    const match = /\/tokens\/(\d+)\/0x[0-9a-fA-F]{40}/i.exec(url);
    if (match) {
      return CHAIN_ID_TO_CHAIN[match[1]] ?? null;
    }

    return null;
  }
}
