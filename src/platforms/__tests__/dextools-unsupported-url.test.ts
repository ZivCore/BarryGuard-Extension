/**
 * Tests for platforms/dextools.ts — detectChainFromUrl and detectUnsupportedChainFromUrl.
 *
 * Plan: plan-cross-chain-address-detection, Schritt 7
 * ADR-015: Unit-Test-Pflicht.
 * ADR-007: Extension is display-only.
 *
 * These are pure URL-parsing methods with no DOM or chrome API involvement.
 * No mocks required — the logic is self-contained regex matching.
 */

import { describe, expect, it, vi } from 'vitest';

// vi.mock stubs satisfy GenericSolanaPlatform constructor-time imports.
// The methods under test do not touch these dependencies.

vi.mock('../platform-utils', () => ({
  createBadgeElement: vi.fn(() => document.createElement('div')),
  renderStripeBadge: vi.fn(),
  renderFloatingPanel: vi.fn(),
  safeSendPopupMessage: vi.fn(),
}));

vi.mock('../host-theme', () => ({
  detectHostThemeCached: vi.fn(() => 'light'),
}));

vi.mock('../address-helpers', () => ({
  dedupeAddresses: vi.fn((a: string[]) => a),
  extractFirstSolanaAddress: vi.fn(() => null),
}));

import { DextoolsPlatform } from '../dextools';

const platform = new DextoolsPlatform();

// ---------------------------------------------------------------------------
// detectUnsupportedChainFromUrl — unsupported chains return {chainSegment, label}
// ---------------------------------------------------------------------------

describe('DextoolsPlatform.detectUnsupportedChainFromUrl — unsupported chains', () => {
  it('detects pulsechain and returns correct segment and label', () => {
    const result = platform.detectUnsupportedChainFromUrl('https://www.dextools.io/app/pulsechain/pair-explorer/0xABC');
    expect(result).not.toBeNull();
    expect(result!.chainSegment).toBe('pulsechain');
    expect(result!.label).toBe('PulseChain');
  });

  it('detects polygon and returns correct segment and label', () => {
    const result = platform.detectUnsupportedChainFromUrl('https://www.dextools.io/app/polygon/pair-explorer/0xABC');
    expect(result).not.toBeNull();
    expect(result!.chainSegment).toBe('polygon');
    expect(result!.label).toBe('Polygon');
  });

  it('detects arbitrum and returns correct segment and label', () => {
    const result = platform.detectUnsupportedChainFromUrl('https://www.dextools.io/app/arbitrum/pair-explorer/0xABC');
    expect(result).not.toBeNull();
    expect(result!.chainSegment).toBe('arbitrum');
    expect(result!.label).toBe('Arbitrum');
  });

  it('detects avalanche and returns correct segment and label', () => {
    const result = platform.detectUnsupportedChainFromUrl('https://www.dextools.io/app/avalanche/pair-explorer/0xABC');
    expect(result).not.toBeNull();
    expect(result!.chainSegment).toBe('avalanche');
    expect(result!.label).toBe('Avalanche');
  });
});

// ---------------------------------------------------------------------------
// detectUnsupportedChainFromUrl — supported chains return null (negative tests)
// ---------------------------------------------------------------------------

describe('DextoolsPlatform.detectUnsupportedChainFromUrl — supported chains return null', () => {
  it('returns null for solana (supported chain)', () => {
    const result = platform.detectUnsupportedChainFromUrl('https://www.dextools.io/app/solana/pair-explorer/SomeMint');
    expect(result).toBeNull();
  });

  it('returns null for ethereum (supported chain)', () => {
    const result = platform.detectUnsupportedChainFromUrl('https://www.dextools.io/app/ethereum/pair-explorer/0xABC');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectUnsupportedChainFromUrl — unknown segment returns null
// ---------------------------------------------------------------------------

describe('DextoolsPlatform.detectUnsupportedChainFromUrl — unknown segment', () => {
  it('returns null for an unrecognised chain segment', () => {
    const result = platform.detectUnsupportedChainFromUrl('https://www.dextools.io/app/unknownchain/pair-explorer/0xABC');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectChainFromUrl — unsupported chain returns null (method ignores them)
// ---------------------------------------------------------------------------

describe('DextoolsPlatform.detectChainFromUrl — unsupported chain returns null', () => {
  it('returns null for pulsechain URL (not in supported set)', () => {
    const result = platform.detectChainFromUrl('https://www.dextools.io/app/pulsechain/pair-explorer/0xABC');
    expect(result).toBeNull();
  });
});
