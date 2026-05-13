/**
 * resolved-scores-soft-cap.test.ts
 *
 * Verifies the FIFO soft-cap behaviour of resolvedScores (RESOLVED_SCORES_MAX = 5000):
 * - inserting 5000 entries fills the map to exactly 5000
 * - the 5001st insert evicts the oldest entry and keeps size at 5000
 * - re-inserting an existing address moves it to the end of insertion order
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { __testHooks, initializeContentScript } from '../../src/content/index';
import { makeMockPlatform, makeScore } from './_mock-platform';

const RESOLVED_SCORES_MAX = 5000;

/** Generate a deterministic address of fixed length 44. */
function addr(n: number): string {
  return `Addr${String(n).padStart(40, '0')}`;
}

describe('resolvedScores soft-cap (FIFO, max 5000)', () => {
  let setResolvedScore: (address: string, score: ReturnType<typeof makeScore>) => void;
  let resolvedScores: Map<string, ReturnType<typeof makeScore>>;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'chrome', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const platform = makeMockPlatform();
    initializeContentScript(platform);

    const hooks = __testHooks as Required<typeof __testHooks>;
    setResolvedScore = hooks.setResolvedScore as typeof setResolvedScore;
    resolvedScores = hooks.resolvedScores as Map<string, ReturnType<typeof makeScore>>;

    resolvedScores.clear();
  });

  it('accepts exactly 5000 entries without truncation', () => {
    for (let i = 0; i < RESOLVED_SCORES_MAX; i++) {
      setResolvedScore(addr(i), makeScore(addr(i)));
    }
    expect(resolvedScores.size).toBe(RESOLVED_SCORES_MAX);
  });

  it('caps at 5000 when the 5001st entry is inserted', () => {
    for (let i = 0; i < RESOLVED_SCORES_MAX; i++) {
      setResolvedScore(addr(i), makeScore(addr(i)));
    }

    const newAddr = addr(RESOLVED_SCORES_MAX);
    setResolvedScore(newAddr, makeScore(newAddr, 99));

    expect(resolvedScores.size).toBe(RESOLVED_SCORES_MAX);
  });

  it('evicts the oldest (first inserted) entry when capacity is exceeded', () => {
    const firstAddr = addr(0);

    for (let i = 0; i < RESOLVED_SCORES_MAX; i++) {
      setResolvedScore(addr(i), makeScore(addr(i)));
    }

    expect(resolvedScores.has(firstAddr)).toBe(true);

    setResolvedScore(addr(RESOLVED_SCORES_MAX), makeScore(addr(RESOLVED_SCORES_MAX), 99));

    expect(resolvedScores.has(firstAddr)).toBe(false);
    expect(resolvedScores.has(addr(RESOLVED_SCORES_MAX))).toBe(true);
  });

  it('re-inserting an existing address updates the score value', () => {
    setResolvedScore(addr(0), makeScore(addr(0), 10));
    setResolvedScore(addr(0), makeScore(addr(0), 20));

    expect(resolvedScores.get(addr(0))?.score).toBe(20);
  });

  it('re-inserting an existing address moves it to the end of insertion order', () => {
    setResolvedScore(addr(0), makeScore(addr(0)));
    setResolvedScore(addr(1), makeScore(addr(1)));
    setResolvedScore(addr(2), makeScore(addr(2)));

    // Re-insert A — must become the newest (last) entry
    setResolvedScore(addr(0), makeScore(addr(0), 77));

    const keys = [...resolvedScores.keys()];
    expect(keys[keys.length - 1]).toBe(addr(0));
    // addr(1) is now the oldest
    expect(keys[0]).toBe(addr(1));
  });

  it('re-inserting an existing address does not grow the map', () => {
    for (let i = 0; i < 10; i++) {
      setResolvedScore(addr(i), makeScore(addr(i)));
    }
    const sizeBefore = resolvedScores.size;

    setResolvedScore(addr(5), makeScore(addr(5), 33));

    expect(resolvedScores.size).toBe(sizeBefore);
  });
});
