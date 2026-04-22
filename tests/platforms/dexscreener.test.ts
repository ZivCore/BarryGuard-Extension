import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DexScreenerPlatform } from '../../src/platforms/dexscreener';

describe('DexScreenerPlatform', () => {
  let platform: DexScreenerPlatform;
  const sendMessage = vi.fn();

  beforeEach(() => {
    sendMessage.mockReset();
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'test-extension-id',
        lastError: null,
        sendMessage,
      },
    });

    platform = new DexScreenerPlatform();
    document.body.innerHTML = '';
    document.title = 'DexScreener';
    window.history.replaceState({}, '', '/solana');
  });

  it('delegates unresolved pair pages to the background API-only resolver', () => {
    window.history.replaceState({}, '', '/solana/pair12345678901234567890');

    const addresses = platform.extractTokenAddresses();

    expect(addresses).toEqual([]);
    expect(sendMessage).toHaveBeenCalledWith(
      {
        type: 'RESOLVE_DEX_PAIR',
        payload: {
          pairs: ['pair12345678901234567890'],
          chain: 'solana',
        },
      },
      expect.any(Function),
    );
  });
});
