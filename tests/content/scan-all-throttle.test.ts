/**
 * scan-all-throttle.test.ts
 *
 * Verifies the burst-throttle behaviour of scheduleScanAll:
 * - multiple rapid calls within the 1500 ms window coalesce into at most 2 scanAll executions
 * - urgent: true bypasses throttle and fires immediately every call
 * - urgent: true during a pending coalesce timer cancels the timer and fires immediately
 * - a regular call within 1500 ms after a scan is coalesced (badgeVerifyTimer simulation)
 */

import { beforeEach, afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { __testHooks, initializeContentScript } from '../../src/content/index';
import { makeMockPlatform } from './_mock-platform';

const SCAN_ALL_MIN_INTERVAL_MS = 1500;

describe('scheduleScanAll throttle', () => {
  let scheduleScanAll: (options?: { urgent?: boolean }) => void;
  let extractSpy: MockInstance<[], string[]>;

  beforeEach(() => {
    vi.useFakeTimers();

    Object.defineProperty(globalThis, 'chrome', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const platform = makeMockPlatform();
    // extractTokenAddresses is called on every scanAll — use it as a scanAll execution counter
    extractSpy = vi.spyOn(platform, 'extractTokenAddresses').mockReturnValue([]);

    initializeContentScript(platform);

    const hooks = __testHooks as Required<typeof __testHooks>;
    scheduleScanAll = hooks.scheduleScanAll;

    // Reset throttle state and clear the startup scanAll call from the spy counter
    hooks._lastScanAllAt = 0;
    if (hooks._pendingScanAllTimer !== null) {
      clearTimeout(hooks._pendingScanAllTimer as ReturnType<typeof setTimeout>);
      // The pending timer variable can't be nulled from outside; advance time to drain it
      vi.advanceTimersByTime(SCAN_ALL_MIN_INTERVAL_MS);
    }
    extractSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first call fires scanAll immediately', () => {
    scheduleScanAll();
    expect(extractSpy).toHaveBeenCalledTimes(1);
  });

  it('10 rapid calls within 100 ms result in exactly 2 scanAll executions after coalesce', () => {
    // First call fires immediately
    scheduleScanAll();
    expect(extractSpy).toHaveBeenCalledTimes(1);

    // 9 more calls within the throttle window — all coalesce
    for (let i = 0; i < 9; i++) {
      scheduleScanAll();
    }
    expect(extractSpy).toHaveBeenCalledTimes(1);

    // Advance past the min interval — coalesced timer fires once
    vi.advanceTimersByTime(SCAN_ALL_MIN_INTERVAL_MS);
    expect(extractSpy).toHaveBeenCalledTimes(2);
  });

  it('urgent: true fires scanAll immediately regardless of elapsed time', () => {
    scheduleScanAll(); // first call
    expect(extractSpy).toHaveBeenCalledTimes(1);

    scheduleScanAll({ urgent: true });
    expect(extractSpy).toHaveBeenCalledTimes(2);

    scheduleScanAll({ urgent: true });
    expect(extractSpy).toHaveBeenCalledTimes(3);
  });

  it('urgent: true cancels a pending coalesce timer and fires immediately', () => {
    const hooks = __testHooks as Required<typeof __testHooks>;

    scheduleScanAll(); // fires immediately, opens throttle window
    expect(extractSpy).toHaveBeenCalledTimes(1);

    scheduleScanAll(); // queues a coalesce timer
    expect(hooks._pendingScanAllTimer).not.toBeNull();

    scheduleScanAll({ urgent: true }); // must cancel timer and fire now
    expect(extractSpy).toHaveBeenCalledTimes(2);
    expect(hooks._pendingScanAllTimer).toBeNull();

    // Advancing past the original coalesce deadline must not fire a third time
    vi.advanceTimersByTime(SCAN_ALL_MIN_INTERVAL_MS);
    expect(extractSpy).toHaveBeenCalledTimes(2);
  });

  it('a regular call within the throttle window is coalesced, not fired immediately', () => {
    scheduleScanAll(); // fires immediately
    expect(extractSpy).toHaveBeenCalledTimes(1);

    // Simulate a badgeVerifyTimer tick at 500 ms — still within the throttle window
    vi.advanceTimersByTime(500);
    scheduleScanAll();

    // Must not have fired a second time yet
    expect(extractSpy).toHaveBeenCalledTimes(1);

    // Advance to end of coalesce window
    vi.advanceTimersByTime(SCAN_ALL_MIN_INTERVAL_MS);
    expect(extractSpy).toHaveBeenCalledTimes(2);
  });
});
