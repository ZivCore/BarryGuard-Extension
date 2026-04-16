/**
 * content-sender-check.test.ts — Step 4 (E-M3)
 * Tests the sender validation logic for content-script message listeners.
 *
 * Every listener must check sender.id === chrome.runtime.id before processing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Inline sender-check logic (mirrors content/index.ts implementation)
// ---------------------------------------------------------------------------

function isTrustedSender(sender: { id?: string }, runtimeId: string): boolean {
  return typeof sender?.id === 'string' && sender.id === runtimeId
}

const RUNTIME_ID = 'exampleextensionid1234567890abcdef'

describe('Content-script sender validation (E-M3)', () => {
  it('accepts messages from the same extension runtime ID', () => {
    expect(isTrustedSender({ id: RUNTIME_ID }, RUNTIME_ID)).toBe(true)
  })

  it('rejects messages from a different extension ID', () => {
    expect(isTrustedSender({ id: 'otherid1234' }, RUNTIME_ID)).toBe(false)
  })

  it('rejects messages with no sender.id', () => {
    expect(isTrustedSender({}, RUNTIME_ID)).toBe(false)
  })

  it('rejects messages where sender.id is null', () => {
    expect(isTrustedSender({ id: undefined }, RUNTIME_ID)).toBe(false)
  })

  it('rejects messages with empty sender.id', () => {
    expect(isTrustedSender({ id: '' }, RUNTIME_ID)).toBe(false)
  })

  it('rejects a web page sender (no id property)', () => {
    const webPageSender = { url: 'https://pump.fun', frameId: 0 }
    expect(isTrustedSender(webPageSender as never, RUNTIME_ID)).toBe(false)
  })

  it('is case-sensitive — different casing is rejected', () => {
    expect(isTrustedSender({ id: RUNTIME_ID.toUpperCase() }, RUNTIME_ID)).toBe(false)
  })

  it('does not allow partial match', () => {
    expect(isTrustedSender({ id: RUNTIME_ID.slice(0, 10) }, RUNTIME_ID)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Listener pattern: returns early without response on untrusted sender
// ---------------------------------------------------------------------------

describe('Listener early-return on untrusted sender', () => {
  function makeListener(runtimeId: string, handler: () => string) {
    return (
      message: unknown,
      sender: { id?: string },
      sendResponse: (data: unknown) => void
    ): boolean => {
      if (!isTrustedSender(sender, runtimeId)) {
        return false // Do not send a response
      }
      sendResponse(handler())
      return true
    }
  }

  it('calls sendResponse only for trusted senders', () => {
    const listener = makeListener(RUNTIME_ID, () => 'pong')
    const sendResponse = vi.fn()

    const result = listener({ type: 'PING' }, { id: RUNTIME_ID }, sendResponse)
    expect(result).toBe(true)
    expect(sendResponse).toHaveBeenCalledWith('pong')
  })

  it('does not call sendResponse for untrusted senders', () => {
    const listener = makeListener(RUNTIME_ID, () => 'pong')
    const sendResponse = vi.fn()

    const result = listener({ type: 'PING' }, { id: 'evil-extension-id' }, sendResponse)
    expect(result).toBe(false)
    expect(sendResponse).not.toHaveBeenCalled()
  })

  it('does not call sendResponse when sender.id is absent', () => {
    const listener = makeListener(RUNTIME_ID, () => 'pong')
    const sendResponse = vi.fn()

    const result = listener({ type: 'PING' }, {}, sendResponse)
    expect(result).toBe(false)
    expect(sendResponse).not.toHaveBeenCalled()
  })
})
