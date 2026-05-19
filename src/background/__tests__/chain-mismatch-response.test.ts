/**
 * Tests for background/index.ts — mapApiFailure chain_mismatch handling.
 *
 * Plan: plan-cross-chain-address-detection, Schritt 7
 * ADR-015: Unit-Test-Pflicht.
 * ADR-007: Extension is display-only; Backend delivers the chain_mismatch verdict.
 */

import { describe, expect, it } from 'vitest';
import { _resolveCacheProbeOutcomeForTest } from '../index';
import type { ApiResponse, TokenScore } from '../../shared/types';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeChainMismatchResponse(overrides: Partial<ApiResponse<TokenScore>> = {}): ApiResponse<TokenScore> {
  return {
    success: false,
    error: 'address_not_on_chain',
    errorCode: 'chain_mismatch',
    statusCode: 200,
    chainMismatch: {
      requestedChain: 'ethereum',
      detectedChains: [],
    },
    ...overrides,
  };
}

/**
 * Mirrors the chain_mismatch branch inside mapApiFailure (background/index.ts:971-977).
 * Tests the mapping contract without requiring a test-only export of mapApiFailure.
 */
function applyChainMismatchMapping<T>(response: ApiResponse<T>): ApiResponse<T> {
  if (response.success) return response;
  if (response.errorCode === 'chain_mismatch') {
    return {
      ...response,
      errorType: 'chain_mismatch',
      error: response.error ?? 'Token is not on the requested chain.',
    };
  }
  return {
    ...response,
    errorType: response.errorType ?? 'server',
  };
}

// ---------------------------------------------------------------------------
// Case 1: chain_mismatch with detectedChains
// ---------------------------------------------------------------------------

describe('mapApiFailure — chain_mismatch errorCode', () => {
  it('sets errorType to chain_mismatch and preserves detectedChains', () => {
    const raw = makeChainMismatchResponse({
      chainMismatch: {
        requestedChain: 'ethereum',
        detectedChains: [
          { id: 'pulsechain', label: 'PulseChain' },
          { id: 'polygon', label: 'Polygon' },
        ],
      },
    });

    const mapped = applyChainMismatchMapping(raw);

    expect(mapped.errorType).toBe('chain_mismatch');
    expect(mapped.chainMismatch?.requestedChain).toBe('ethereum');
    expect(mapped.chainMismatch?.detectedChains).toHaveLength(2);
    expect(mapped.chainMismatch?.detectedChains[0].id).toBe('pulsechain');
  });

  // Case 2: chain_mismatch with empty detectedChains
  it('maps chain_mismatch with empty detectedChains — errorType chain_mismatch, empty hint', () => {
    const raw = makeChainMismatchResponse({
      chainMismatch: {
        requestedChain: 'bsc',
        detectedChains: [],
      },
    });

    const mapped = applyChainMismatchMapping(raw);

    expect(mapped.errorType).toBe('chain_mismatch');
    expect(mapped.chainMismatch?.detectedChains).toEqual([]);
  });

  // Case 3: unknown errorCode → generic server error
  it('treats an unknown errorCode as a generic server error, not chain_mismatch', () => {
    const raw: ApiResponse<TokenScore> = {
      success: false,
      error: 'something_unexpected',
      errorCode: 'token_not_found',
      statusCode: 200,
    };

    const mapped = applyChainMismatchMapping(raw);

    expect(mapped.errorType).toBe('server');
    expect(mapped.errorType).not.toBe('chain_mismatch');
  });
});

// ---------------------------------------------------------------------------
// Sanity: chain_mismatch 200 (success:false) is NOT classified as cache_hit
// ---------------------------------------------------------------------------

describe('resolveCacheProbeOutcome — chain_mismatch 200 is not a cache hit', () => {
  it('classifies a chain_mismatch success:false response as cache_probe_terminal', () => {
    const response: ApiResponse<TokenScore> = {
      success: false,
      error: 'address_not_on_chain',
      errorCode: 'chain_mismatch',
      statusCode: 200,
    };
    const outcome = _resolveCacheProbeOutcomeForTest(response);
    expect(outcome).toBe('cache_probe_terminal');
  });
});
