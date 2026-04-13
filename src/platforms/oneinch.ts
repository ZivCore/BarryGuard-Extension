import { GenericEvmPlatform } from './generic-evm';

const CHAIN_ID_MAP: Record<string, string> = {
  '1': 'ethereum',
  '56': 'bsc',
  '8453': 'base',
};

export class OneInchPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'oneinch',
      name: '1inch',
      hostPattern: ['*://app.1inch.io/*'],
      hostnames: ['app.1inch.io'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      // Hash-based: /#/{chainId}/simple/swap/{tokenIn}/{tokenOut}
      currentAddressExtractor: (location) => {
        const hash = location.hash;
        const match = hash.match(/^#\/(\d+)\/simple\/swap\/(0x[0-9a-fA-F]{40})(?:\/|$)/i);
        if (!match) return null;
        const chain = CHAIN_ID_MAP[match[1]];
        if (!chain) return null;
        return match[2];
      },
      anchorSelectors: ['a[href*="swap"]', '[data-testid*="token"]'],
      compactBadge: true,
    });
  }

  override detectChainFromUrl(url: string): string | null {
    // Hash pattern: /#/{chainId}/...
    const hashMatch = url.match(/#\/(\d+)\//);
    if (hashMatch) {
      return CHAIN_ID_MAP[hashMatch[1]] ?? null;
    }
    return null;
  }
}
