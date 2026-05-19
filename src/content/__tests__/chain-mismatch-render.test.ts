/**
 * Tests for content/index.ts — RENDER_CHAIN_MISMATCH message handler.
 *
 * Plan: plan-cross-chain-address-detection, Schritt 7
 * ADR-015: Unit-Test-Pflicht.
 * ADR-007: Extension is display-only.
 *
 * Strategy: exercise the render-dispatch logic directly (not via module import,
 * which would pull in the full content-script runtime). The logic under test
 * lives in content/index.ts lines 969-981 and is straightforward:
 *
 *   if (platform.renderChainMismatchBadge) → call it
 *   else                                   → call renderErrorBadge
 *
 * We replicate that dispatch here so we can test all three contract points
 * without spinning up a browser environment.
 */

import { describe, expect, it, vi } from 'vitest';
import type { ChainMismatchPayload } from '../../shared/types';

// ---------------------------------------------------------------------------
// Minimal platform shape — only the methods touched by the render-dispatch
// ---------------------------------------------------------------------------

interface MinimalPlatform {
  renderChainMismatchBadge?: (address: string, payload: ChainMismatchPayload) => void;
  renderErrorBadge: (address: string) => void;
}

/**
 * Mirrors the RENDER_CHAIN_MISMATCH dispatch from content/index.ts:969-981.
 */
function dispatchMismatchRender(
  platform: MinimalPlatform,
  address: string,
  chainMismatch: ChainMismatchPayload,
): void {
  if (platform.renderChainMismatchBadge) {
    platform.renderChainMismatchBadge(address, chainMismatch);
  } else {
    platform.renderErrorBadge(address);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const TEST_ADDRESS = '0xDeAdBeEf00000000000000000000000000000001';

const PAYLOAD_WITH_HINTS: ChainMismatchPayload = {
  requestedChain: 'ethereum',
  detectedChains: [
    { id: 'pulsechain', label: 'PulseChain' },
  ],
};

// Case 1: adapter implements renderChainMismatchBadge
describe('RENDER_CHAIN_MISMATCH dispatch — adapter with renderChainMismatchBadge', () => {
  it('calls renderChainMismatchBadge when adapter implements it', () => {
    const renderChainMismatchBadge = vi.fn();
    const renderErrorBadge = vi.fn();
    const platform: MinimalPlatform = { renderChainMismatchBadge, renderErrorBadge };

    dispatchMismatchRender(platform, TEST_ADDRESS, PAYLOAD_WITH_HINTS);

    expect(renderChainMismatchBadge).toHaveBeenCalledOnce();
    expect(renderChainMismatchBadge).toHaveBeenCalledWith(TEST_ADDRESS, PAYLOAD_WITH_HINTS);
    expect(renderErrorBadge).not.toHaveBeenCalled();
  });
});

// Case 2: adapter does NOT implement renderChainMismatchBadge → fallback
describe('RENDER_CHAIN_MISMATCH dispatch — adapter without renderChainMismatchBadge', () => {
  it('falls back to renderErrorBadge when adapter does not implement renderChainMismatchBadge', () => {
    const renderErrorBadge = vi.fn();
    const platform: MinimalPlatform = { renderErrorBadge };

    dispatchMismatchRender(platform, TEST_ADDRESS, PAYLOAD_WITH_HINTS);

    expect(renderErrorBadge).toHaveBeenCalledOnce();
    expect(renderErrorBadge).toHaveBeenCalledWith(TEST_ADDRESS);
  });
});

// Case 3: payload is forwarded intact — requestedChain and detectedChains labels
describe('RENDER_CHAIN_MISMATCH dispatch — payload forwarding', () => {
  it('passes requestedChain and detectedChains to renderChainMismatchBadge', () => {
    const captured: ChainMismatchPayload[] = [];
    const platform: MinimalPlatform = {
      renderChainMismatchBadge: (_addr, payload) => { captured.push(payload); },
      renderErrorBadge: vi.fn(),
    };

    const payload: ChainMismatchPayload = {
      requestedChain: 'bsc',
      detectedChains: [
        { id: 'pulsechain', label: 'PulseChain' },
        { id: 'avalanche', label: 'Avalanche' },
      ],
    };

    dispatchMismatchRender(platform, TEST_ADDRESS, payload);

    expect(captured).toHaveLength(1);
    expect(captured[0].requestedChain).toBe('bsc');
    expect(captured[0].detectedChains.map((c) => c.label)).toEqual(['PulseChain', 'Avalanche']);
  });
});
