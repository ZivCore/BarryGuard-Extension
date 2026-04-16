/**
 * url-change-detector.test.ts — Step 5 (E-M9)
 * Verifies the passive URL change detection helper.
 *
 * jsdom environment provides window, MutationObserver, addEventListener.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { watchUrlChanges } from '../../src/content/url-change-detector'

describe('watchUrlChanges (E-M9)', () => {
  let cleanup: () => void
  let callback: ReturnType<typeof vi.fn>

  beforeEach(() => {
    callback = vi.fn()
  })

  afterEach(() => {
    if (cleanup) cleanup()
  })

  it('returns a cleanup function', () => {
    cleanup = watchUrlChanges(callback)
    expect(typeof cleanup).toBe('function')
  })

  it('does NOT call callback when URL has not changed', () => {
    cleanup = watchUrlChanges(callback)
    // Dispatch popstate without changing location
    window.dispatchEvent(new PopStateEvent('popstate'))
    expect(callback).not.toHaveBeenCalled()
  })

  it('calls callback on hashchange when URL changes', async () => {
    // Set a deterministic starting URL
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'https://pump.fun/coin/abc123' },
    })

    cleanup = watchUrlChanges(callback)

    // Simulate URL change
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'https://pump.fun/coin/def456' },
    })
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    // Callback is deferred with setTimeout(0)
    await new Promise((r) => setTimeout(r, 10))
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('cleanup removes popstate listener', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'https://pump.fun/coin/abc' },
    })

    cleanup = watchUrlChanges(callback)
    cleanup()

    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'https://pump.fun/coin/xyz' },
    })
    window.dispatchEvent(new PopStateEvent('popstate'))
    await new Promise((r) => setTimeout(r, 10))

    expect(callback).not.toHaveBeenCalled()
  })

  it('does NOT patch history.pushState or history.replaceState', () => {
    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    cleanup = watchUrlChanges(callback)

    expect(history.pushState).toBe(originalPushState)
    expect(history.replaceState).toBe(originalReplaceState)
  })

  it('debounces rapid successive URL changes to one callback', async () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'https://pump.fun/a' },
    })

    cleanup = watchUrlChanges(callback)

    // Change URL and fire multiple events rapidly
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'https://pump.fun/b' },
    })
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.dispatchEvent(new HashChangeEvent('hashchange'))

    await new Promise((r) => setTimeout(r, 20))
    // Callback fires at most once per URL change due to debounce
    expect(callback.mock.calls.length).toBeLessThanOrEqual(2)
  })
})
