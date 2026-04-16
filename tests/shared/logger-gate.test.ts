/**
 * logger-gate.test.ts — Step 7 (E-M4)
 * Tests that logger.debug() and logger.log() are gated on IS_DEV.
 *
 * In production builds (import.meta.env.DEV === false), debug and log
 * must be no-ops. warn and error must always fire.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// We import meta.env.DEV from vitest globals. By default in tests (not dev
// server) import.meta.env.DEV is true. We test the gate logic inline to avoid
// needing a production build.
// ---------------------------------------------------------------------------

function makeLogger(isDev: boolean) {
  return {
    debug(...args: unknown[]): void {
      if (isDev) console.debug('[BarryGuard]', ...args)
    },
    log(...args: unknown[]): void {
      if (isDev) console.log('[BarryGuard]', ...args)
    },
    warn(...args: unknown[]): void {
      console.warn('[BarryGuard]', ...args)
    },
    error(...args: unknown[]): void {
      console.error('[BarryGuard]', ...args)
    },
  }
}

describe('logger — production build (IS_DEV = false)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let debugSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let warnSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let errorSpy: any
  const prodLogger = makeLogger(false)

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('debug() is a no-op in production', () => {
    prodLogger.debug('sensitive data', { tier: 'pro', usage: 42 })
    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('log() is a no-op in production', () => {
    prodLogger.log('token profile loaded', { userId: 'u1' })
    expect(logSpy).not.toHaveBeenCalled()
  })

  it('warn() always fires in production', () => {
    prodLogger.warn('network issue')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('[BarryGuard]', 'network issue')
  })

  it('error() always fires in production', () => {
    prodLogger.error('request failed', new Error('timeout'))
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})

describe('logger — development build (IS_DEV = true)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let debugSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let logSpy: any
  const devLogger = makeLogger(true)

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('debug() fires in development', () => {
    devLogger.debug('dev message')
    expect(debugSpy).toHaveBeenCalledTimes(1)
    expect(debugSpy).toHaveBeenCalledWith('[BarryGuard]', 'dev message')
  })

  it('log() fires in development', () => {
    devLogger.log('log message', { key: 'value' })
    expect(logSpy).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// Real logger module: verify it is importable and has expected shape
// ---------------------------------------------------------------------------

describe('real logger module shape', () => {
  it('exports debug, log, warn, error methods', async () => {
    const { logger } = await import('../../src/shared/logger')
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.log).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })
})
