import { GenericEvmPlatform } from './generic-evm';

const CHAIN_SLUG_MAP: Record<string, string> = {
  ethereum: 'ethereum',
  bsc: 'bsc',
  base: 'base',
};

function slugToChain(slug: string): string | null {
  return CHAIN_SLUG_MAP[slug.toLowerCase()] ?? null;
}

export class SushiSwapPlatform extends GenericEvmPlatform {
  constructor() {
    super({
      id: 'sushiswap',
      name: 'SushiSwap',
      hostPattern: ['*://www.sushi.com/*', '*://sushi.com/*'],
      hostnames: ['www.sushi.com', 'sushi.com'],
      chain: 'ethereum',
      chains: ['ethereum', 'bsc', 'base'],
      currentAddressExtractor: (location) => {
        // /{chainSlug}/swap?token1={address}
        const swapMatch = location.pathname.match(/^\/([^/]+)\/swap$/i);
        if (swapMatch) {
          const chain = slugToChain(swapMatch[1]);
          if (!chain) return null;
          const params = new URLSearchParams(location.search);
          const token = params.get('token1');
          if (token && /^0x[0-9a-fA-F]{40}$/.test(token)) return token;
        }
        // /{chainSlug}/pool/*
        const poolMatch = location.pathname.match(/^\/([^/]+)\/pool\//i);
        if (poolMatch) {
          const chain = slugToChain(poolMatch[1]);
          if (!chain) return null;
          const addrMatch = location.pathname.match(/0x[0-9a-fA-F]{40}/i);
          return addrMatch ? addrMatch[0] : null;
        }
        return null;
      },
      anchorSelectors: [
        'a[href*="/swap"]',
        'a[href*="/pool"]',
        '[data-testid*="token"]',
      ],
      compactBadge: true,
    });
  }

  override detectChainFromUrl(url: string): string | null {
    const match = url.match(/(?:sushi\.com)\/?([^/?#]+)/i);
    if (match) {
      const chain = slugToChain(match[1]);
      if (chain) return chain;
    }
    return null;
  }
}
