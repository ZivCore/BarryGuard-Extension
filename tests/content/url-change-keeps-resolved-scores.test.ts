/**
 * url-change-keeps-resolved-scores.test.ts
 *
 * Verifies that handleUrlChange (SPA navigation) does NOT clear resolvedScores.
 * Tokens resolved before navigation must remain cached and must not trigger a
 * new ANALYZE_TOKEN_LIST message when they re-appear on the next page.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __testHooks, initializeContentScript } from '../../src/content/index';
import { clearAllBadges, makeMockPlatform, makeScore } from './_mock-platform';

const ADDR_A = 'TokenAddrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('handleUrlChange keeps resolvedScores intact', () => {
  let platform: ReturnType<typeof makeMockPlatform>;

  beforeEach(() => {
    clearAllBadges();

    platform = makeMockPlatform();
    vi.mocked(platform.extractTokenAddresses).mockReturnValue([]);
    vi.mocked(platform.getCurrentPageAddress).mockReturnValue(null);

    Object.defineProperty(globalThis, 'chrome', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com/page-a' },
      writable: true,
      configurable: true,
    });

    initializeContentScript(platform);
  });

  it('resolvedScores still contains token A after URL change', () => {
    const { setResolvedScore, handleUrlChange, resolvedScores } = __testHooks as Required<typeof __testHooks>;

    setResolvedScore(ADDR_A, makeScore(ADDR_A, 80));
    expect(resolvedScores.has(ADDR_A)).toBe(true);

    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com/page-b' },
      writable: true,
      configurable: true,
    });
    handleUrlChange();

    expect(resolvedScores.has(ADDR_A)).toBe(true);
  });

  it('score value is unchanged after URL change', () => {
    const { setResolvedScore, handleUrlChange, resolvedScores } = __testHooks as Required<typeof __testHooks>;

    setResolvedScore(ADDR_A, makeScore(ADDR_A, 42));

    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com/page-c' },
      writable: true,
      configurable: true,
    });
    handleUrlChange();

    expect(resolvedScores.get(ADDR_A)?.score).toBe(42);
  });

  it('does not send ANALYZE_TOKEN_LIST for a resolved token that re-appears after navigation', () => {
    const sendMessageSpy = vi.fn();
    Object.defineProperty(globalThis, 'chrome', {
      value: {
        runtime: {
          id: 'test-ext-id',
          sendMessage: sendMessageSpy,
          lastError: undefined,
          onMessage: { addListener: vi.fn() },
        },
        storage: {
          local: {
            get: vi.fn().mockResolvedValue({}),
            set: vi.fn().mockResolvedValue(undefined),
          },
          onChanged: { addListener: vi.fn() },
        },
      },
      writable: true,
      configurable: true,
    });

    initializeContentScript(platform);
    const { setResolvedScore, handleUrlChange, resolvedScores } = __testHooks as Required<typeof __testHooks>;

    setResolvedScore(ADDR_A, makeScore(ADDR_A, 90));

    Object.defineProperty(window, 'location', {
      value: { href: 'https://example.com/page-d' },
      writable: true,
      configurable: true,
    });
    handleUrlChange();

    sendMessageSpy.mockClear();

    // Token A re-appears in the new page DOM
    vi.mocked(platform.extractTokenAddresses).mockReturnValue([ADDR_A]);

    // resolvedScores still has A, so scanAll's needsFetch excludes it — no batch call
    expect(resolvedScores.has(ADDR_A)).toBe(true);

    const analyzeListCalls = sendMessageSpy.mock.calls.filter(
      (args: unknown[]) => (args[0] as { type?: string })?.type === 'ANALYZE_TOKEN_LIST',
    );
    expect(analyzeListCalls).toHaveLength(0);
  });
});
