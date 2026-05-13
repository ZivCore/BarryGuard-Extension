/**
 * Shared mock IPlatform factory for content-script unit tests.
 * Provides a minimal no-op platform that renders badges as real DOM elements
 * so badge-presence assertions work with jsdom.
 */
import { vi } from 'vitest';
import type { IPlatform } from '../../src/platforms/platform.interface';
import type { SelectedToken, TokenScore } from '../../src/shared/types';

export function makeMockPlatform(overrides?: Partial<IPlatform>): IPlatform {
  return {
    id: 'mock',
    name: 'Mock Platform',
    hostPattern: ['*'],
    matchesLocation: vi.fn(() => true),
    extractTokenAddresses: vi.fn<[], string[]>(() => []),
    getCurrentPageAddress: vi.fn<[], string | null>(() => null),
    buildSelectedToken: vi.fn((address: string, score: TokenScore): SelectedToken => ({
      address,
      score,
    })),
    renderScoreBadge: vi.fn((address: string) => {
      ensureBadge(address);
    }),
    renderLoadingBadge: vi.fn((address: string) => {
      ensureBadge(address);
    }),
    renderErrorBadge: vi.fn((address: string) => {
      ensureBadge(address);
    }),
    renderLockedBadge: vi.fn((address: string) => {
      ensureBadge(address);
    }),
    observeDOMChanges: vi.fn(),
    chains: ['solana'],
    ...overrides,
  };
}

function ensureBadge(address: string): void {
  if (document.querySelector(`[data-barryguard-badge="${address}"]`)) return;
  const el = document.createElement('span');
  el.dataset['barryguardBadge'] = address;
  document.body.appendChild(el);
}

/** Remove all barryguard badge elements from the DOM. */
export function clearAllBadges(): void {
  document.querySelectorAll('[data-barryguard-badge]').forEach((el) => el.remove());
}

/** Build a minimal valid TokenScore. */
export function makeScore(address: string, score = 80): TokenScore {
  return {
    address,
    chain: 'solana',
    score,
    risk: 'low',
    checks: {},
    cached: false,
  };
}
