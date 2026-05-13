/**
 * sync-visible-badges-preserves-memo.test.ts
 *
 * Verifies that syncVisibleBadges removes DOM badges for tokens that are no
 * longer visible but does NOT evict them from resolvedScores.
 * Re-appearing tokens must be re-rendered from cache without a network call.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __testHooks, initializeContentScript } from '../../src/content/index';
import { clearAllBadges, makeMockPlatform, makeScore } from './_mock-platform';

const ADDR_A = 'TokenAddrAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('syncVisibleBadges preserves resolvedScores memo', () => {
  let platform: ReturnType<typeof makeMockPlatform>;

  beforeEach(() => {
    clearAllBadges();

    platform = makeMockPlatform();
    vi.mocked(platform.extractTokenAddresses).mockReturnValue([]);
    vi.mocked(platform.getCurrentPageAddress).mockReturnValue(null);

    // No chrome global — withSafeRuntime is a no-op
    Object.defineProperty(globalThis, 'chrome', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    initializeContentScript(platform);
  });

  it('removes the DOM badge when token is no longer visible', () => {
    const { setResolvedScore, syncVisibleBadges, resolvedScores } = __testHooks as Required<typeof __testHooks>;

    setResolvedScore(ADDR_A, makeScore(ADDR_A));
    const el = document.createElement('span');
    el.dataset['barryguardBadge'] = ADDR_A;
    document.body.appendChild(el);

    expect(document.querySelector(`[data-barryguard-badge="${ADDR_A}"]`)).not.toBeNull();

    syncVisibleBadges([]);

    expect(document.querySelector(`[data-barryguard-badge="${ADDR_A}"]`)).toBeNull();
    // resolvedScores must still hold the entry
    expect(resolvedScores.has(ADDR_A)).toBe(true);
  });

  it('preserves score value in resolvedScores after DOM badge removal', () => {
    const { setResolvedScore, syncVisibleBadges, resolvedScores } = __testHooks as Required<typeof __testHooks>;

    setResolvedScore(ADDR_A, makeScore(ADDR_A, 55));
    const el = document.createElement('span');
    el.dataset['barryguardBadge'] = ADDR_A;
    document.body.appendChild(el);

    syncVisibleBadges([]);

    expect(resolvedScores.has(ADDR_A)).toBe(true);
    expect(resolvedScores.get(ADDR_A)?.score).toBe(55);
  });

  it('re-renders badge from cache when token reappears without triggering ANALYZE_TOKEN_LIST', () => {
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
    const { setResolvedScore, syncVisibleBadges, resolvedScores } = __testHooks as Required<typeof __testHooks>;

    const score = makeScore(ADDR_A, 72);
    setResolvedScore(ADDR_A, score);

    // Insert and then hide badge
    const el = document.createElement('span');
    el.dataset['barryguardBadge'] = ADDR_A;
    document.body.appendChild(el);
    syncVisibleBadges([]);

    sendMessageSpy.mockClear();

    // Token reappears — re-render from cached score (same path scanAll uses)
    const cached = resolvedScores.get(ADDR_A);
    expect(cached).toBeDefined();
    platform.renderScoreBadge(ADDR_A, cached!);

    // No ANALYZE_TOKEN_LIST message must have been sent
    const analyzeListCalls = sendMessageSpy.mock.calls.filter(
      (args: unknown[]) => (args[0] as { type?: string })?.type === 'ANALYZE_TOKEN_LIST',
    );
    expect(analyzeListCalls).toHaveLength(0);

    expect(document.querySelector(`[data-barryguard-badge="${ADDR_A}"]`)).not.toBeNull();
  });
});
