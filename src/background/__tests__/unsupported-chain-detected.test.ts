/**
 * Tests for background/index.ts — UNSUPPORTED_CHAIN_DETECTED handler.
 *
 * Plan: plan-cross-chain-address-detection, Schritt 7
 * ADR-015: Unit-Test-Pflicht.
 * ADR-007: Extension is display-only.
 *
 * The handler is inline inside chrome.runtime.onMessage and has no exported
 * test hook. We mirror its dispatch logic locally (same pattern used for
 * chain-mismatch-response.test.ts and chain-mismatch-render.test.ts).
 *
 * Contract points under test:
 *   1. When address + label are valid, postExtensionHealthEvent is called with
 *      eventKind 'unsupported_chain_url_detected'.
 *   2. chrome.tabs.sendMessage is called with type 'RENDER_CHAIN_MISMATCH' and
 *      the correct payload (requestedChain = label, detectedChains = []).
 *   3. When address or label is missing/invalid, neither health event nor
 *      sendMessage is called.
 */

import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Types mirroring what the handler receives
// ---------------------------------------------------------------------------

interface UnsupportedChainPayload {
  address?: unknown;
  chainSegment?: unknown;
  label?: unknown;
  platformId?: unknown;
}

interface MockSender {
  tab?: { id: number; url?: string };
}

// ---------------------------------------------------------------------------
// Handler mirror — exact logic from background/index.ts:2108-2138
// ---------------------------------------------------------------------------

async function handleUnsupportedChainDetected(
  payload: UnsupportedChainPayload | undefined,
  sender: MockSender,
  postExtensionHealthEvent: (args: {
    platformId: string;
    eventKind: string;
    tabId: number;
    tabUrl: string | null;
  }) => Promise<void>,
  sendMessage: (tabId: number, message: unknown) => Promise<void>,
): Promise<void> {
  const unsupportedAddress = typeof payload?.address === 'string' ? payload.address : '';
  const unsupportedLabel = typeof payload?.label === 'string' ? payload.label : '';
  const senderTabId = sender.tab?.id;

  if (senderTabId !== undefined && unsupportedAddress && unsupportedLabel) {
    await postExtensionHealthEvent({
      platformId: typeof payload?.platformId === 'string' ? payload.platformId : '',
      eventKind: 'unsupported_chain_url_detected',
      tabId: senderTabId,
      tabUrl: sender.tab?.url ?? null,
    }).catch(() => {
      // best-effort telemetry
    });

    sendMessage(senderTabId, {
      type: 'RENDER_CHAIN_MISMATCH',
      payload: {
        address: unsupportedAddress,
        chainMismatch: {
          requestedChain: unsupportedLabel,
          detectedChains: [],
        },
      },
    }).catch(() => {
      // content script may be unavailable
    });
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const VALID_ADDRESS = '0xDeAdBeEf00000000000000000000000000000001';
const VALID_LABEL = 'PulseChain';
const SENDER: MockSender = { tab: { id: 42, url: 'https://dexscreener.com/pulsechain/0xABC' } };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UNSUPPORTED_CHAIN_DETECTED handler — health event', () => {
  it('fires unsupported_chain_url_detected health event when address and label are valid', async () => {
    const postHealthEvent = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUnsupportedChainDetected(
      { address: VALID_ADDRESS, label: VALID_LABEL, chainSegment: 'pulsechain', platformId: 'dexscreener' },
      SENDER,
      postHealthEvent,
      sendMessage,
    );

    expect(postHealthEvent).toHaveBeenCalledOnce();
    expect(postHealthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventKind: 'unsupported_chain_url_detected' }),
    );
  });

  it('includes the correct tabId in the health event', async () => {
    const postHealthEvent = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUnsupportedChainDetected(
      { address: VALID_ADDRESS, label: VALID_LABEL },
      { tab: { id: 99, url: 'https://example.com' } },
      postHealthEvent,
      sendMessage,
    );

    expect(postHealthEvent).toHaveBeenCalledWith(
      expect.objectContaining({ tabId: 99 }),
    );
  });
});

describe('UNSUPPORTED_CHAIN_DETECTED handler — RENDER_CHAIN_MISMATCH dispatch', () => {
  it('sends RENDER_CHAIN_MISMATCH with requestedChain = label and empty detectedChains', async () => {
    const postHealthEvent = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUnsupportedChainDetected(
      { address: VALID_ADDRESS, label: VALID_LABEL, platformId: 'dexscreener' },
      SENDER,
      postHealthEvent,
      sendMessage,
    );

    expect(sendMessage).toHaveBeenCalledOnce();
    const [tabId, message] = sendMessage.mock.calls[0] as [number, {
      type: string;
      payload: { address: string; chainMismatch: { requestedChain: string; detectedChains: unknown[] } };
    }];
    expect(tabId).toBe(42);
    expect(message.type).toBe('RENDER_CHAIN_MISMATCH');
    expect(message.payload.address).toBe(VALID_ADDRESS);
    expect(message.payload.chainMismatch.requestedChain).toBe(VALID_LABEL);
    expect(message.payload.chainMismatch.detectedChains).toEqual([]);
  });
});

describe('UNSUPPORTED_CHAIN_DETECTED handler — guard: missing address or label', () => {
  it('does not fire health event or sendMessage when address is missing', async () => {
    const postHealthEvent = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUnsupportedChainDetected(
      { label: VALID_LABEL },
      SENDER,
      postHealthEvent,
      sendMessage,
    );

    expect(postHealthEvent).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not fire health event or sendMessage when label is missing', async () => {
    const postHealthEvent = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUnsupportedChainDetected(
      { address: VALID_ADDRESS },
      SENDER,
      postHealthEvent,
      sendMessage,
    );

    expect(postHealthEvent).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not fire health event or sendMessage when sender has no tab', async () => {
    const postHealthEvent = vi.fn().mockResolvedValue(undefined);
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    await handleUnsupportedChainDetected(
      { address: VALID_ADDRESS, label: VALID_LABEL },
      {},
      postHealthEvent,
      sendMessage,
    );

    expect(postHealthEvent).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
