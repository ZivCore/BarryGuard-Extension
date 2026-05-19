/**
 * Tests for popup/render.ts — renderChainMismatchCard.
 *
 * Plan: plan-cross-chain-address-detection, Schritt 7
 * ADR-015: Unit-Test-Pflicht.
 * ADR-007: Extension is display-only.
 *
 * renderChainMismatchCard(container, payload) is a pure DOM-mutation function.
 * No chrome.* APIs involved — tests run in jsdom directly.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { renderChainMismatchCard } from '../render';
import type { ChainMismatchPayload } from '../../shared/types';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Case 1: headline contains requestedChain label
describe('renderChainMismatchCard — headline', () => {
  it('shows a headline containing the requestedChain', () => {
    const payload: ChainMismatchPayload = {
      requestedChain: 'ethereum',
      detectedChains: [],
    };

    renderChainMismatchCard(container, payload);

    const headline = container.querySelector('.chain-mismatch-headline');
    expect(headline).not.toBeNull();
    expect(headline!.textContent).toContain('ethereum');
  });
});

// Case 2: renders chain chips for each detected chain
describe('renderChainMismatchCard — chain chips', () => {
  it('renders a chip for each detected chain', () => {
    const payload: ChainMismatchPayload = {
      requestedChain: 'bsc',
      detectedChains: [
        { id: 'pulsechain', label: 'PulseChain' },
        { id: 'avalanche', label: 'Avalanche' },
      ],
    };

    renderChainMismatchCard(container, payload);

    const chips = container.querySelectorAll('.chain-mismatch-chip');
    expect(chips).toHaveLength(2);
    const labels = Array.from(chips).map((c) => c.textContent);
    expect(labels).toContain('PulseChain');
    expect(labels).toContain('Avalanche');
  });
});

// Case 3: no detectedChains — chips section is omitted, headline still present
describe('renderChainMismatchCard — empty detectedChains', () => {
  it('does not render chips when detectedChains is empty', () => {
    const payload: ChainMismatchPayload = {
      requestedChain: 'ethereum',
      detectedChains: [],
    };

    renderChainMismatchCard(container, payload);

    const chips = container.querySelectorAll('.chain-mismatch-chip');
    expect(chips).toHaveLength(0);

    const headline = container.querySelector('.chain-mismatch-headline');
    expect(headline).not.toBeNull();
  });
});
