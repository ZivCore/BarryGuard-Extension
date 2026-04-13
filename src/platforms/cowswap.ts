import { GenericEvmPlatform } from './generic-evm';

const CHAIN_ID_MAP: Record<string, string> = {
  '1': 'ethereum',
  '8453': 'base',
  // 100 = gnosis — not supported, intentionally omitted
};

export class CowSwapPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'cowswap',
      name: 'CoW Swap',
      hostPattern: ['*://swap.cow.fi/*'],
      hostnames: ['swap.cow.fi'],
      chain: 'ethereum',
      chains: ['ethereum', 'base'],
      // Hash-based: /#/{chainId}/swap/{tokenIn}/{tokenOut}
      currentAddressExtractor: (location) => {
        const hash = location.hash;
        const match = hash.match(/^#\/(\d+)\/swap\/(0x[0-9a-fA-F]{40})(?:\/|$)/i);
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
    const hashMatch = url.match(/#\/(\d+)\//);
    if (hashMatch) {
      return CHAIN_ID_MAP[hashMatch[1]] ?? null;
    }
    return null;
  }
}
