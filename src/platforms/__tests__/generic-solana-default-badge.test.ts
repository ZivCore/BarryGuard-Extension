/**
 * Tests for platforms/generic-solana.ts — renderChainMismatchBadge default implementation.
 *
 * Plan: plan-cross-chain-address-detection, Schritt 7
 * ADR-015: Unit-Test-Pflicht.
 * ADR-007: Extension is display-only.
 *
 * The default implementation in GenericSolanaPlatform.renderChainMismatchBadge
 * delegates to renderStripeBadge (state: 'error') and sets a tooltip with
 * "Not on <requestedChain>" and "Active on: <labels>" when detectedChains exist.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChainMismatchPayload } from '../../shared/types';

// getBadge() looks up: document.querySelector(`[data-barryguard-badge="${address}"]`)
// We plant badges with that attribute in beforeEach so the method finds them.

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ADDRESS_1 = '0xDeAdBeEf00000000000000000000000000000001';
const ADDRESS_2 = '0xDeAdBeEf00000000000000000000000000000002';

function plantBadge(address: string): HTMLDivElement {
  const badge = document.createElement('div') as HTMLDivElement;
  badge.setAttribute('data-barryguard-badge', address);
  document.body.appendChild(badge);
  return badge;
}

/** Plant an h1 target so getDetailTarget() returns it (falls through from getTargetElement). */
function plantDetailTarget(): HTMLHeadingElement {
  const h1 = document.createElement('h1');
  document.body.appendChild(h1);
  return h1;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GenericSolanaPlatform.renderChainMismatchBadge — default implementation', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  // Case 1: delegates to renderStripeBadge with state 'error'
  it('calls renderStripeBadge with state:error (delegates like renderErrorBadge)', async () => {
    const utils = await import('../platform-utils');
    const renderStripeBadgeMock = utils.renderStripeBadge as ReturnType<typeof vi.fn>;
    renderStripeBadgeMock.mockClear();

    const { GenericSolanaPlatform } = await import('../generic-solana');
    const platform = new GenericSolanaPlatform({
      id: 'test',
      name: 'Test',
      hostPattern: ['*://example.com/*'],
      hostnames: ['example.com'],
    });

    // Make isCurrentTokenPage return true so getDetailTarget is used.
    vi.spyOn(platform as unknown as { isCurrentTokenPage: (a: string) => boolean }, 'isCurrentTokenPage').mockReturnValue(true);

    plantDetailTarget();
    const badge = plantBadge(ADDRESS_1);

    const payload: ChainMismatchPayload = {
      requestedChain: 'ethereum',
      detectedChains: [],
    };

    platform.renderChainMismatchBadge(ADDRESS_1, payload);

    expect(renderStripeBadgeMock).toHaveBeenCalledWith(
      badge,
      expect.objectContaining({ state: 'error' }),
    );
  });

  // Case 2: badge title includes detected chain labels
  it('includes detected chain labels in badge title', async () => {
    vi.resetModules();

    const { GenericSolanaPlatform } = await import('../generic-solana');
    const platform = new GenericSolanaPlatform({
      id: 'test',
      name: 'Test',
      hostPattern: ['*://example.com/*'],
      hostnames: ['example.com'],
    });

    // Make isCurrentTokenPage return true so getDetailTarget is used.
    vi.spyOn(platform as unknown as { isCurrentTokenPage: (a: string) => boolean }, 'isCurrentTokenPage').mockReturnValue(true);

    plantDetailTarget();
    const badge = plantBadge(ADDRESS_2);

    const payload: ChainMismatchPayload = {
      requestedChain: 'ethereum',
      detectedChains: [
        { id: 'pulsechain', label: 'PulseChain' },
        { id: 'polygon', label: 'Polygon' },
      ],
    };

    platform.renderChainMismatchBadge(ADDRESS_2, payload);

    expect(badge.title).toContain('Not on ethereum');
    expect(badge.title).toContain('PulseChain');
    expect(badge.title).toContain('Polygon');
  });
});
