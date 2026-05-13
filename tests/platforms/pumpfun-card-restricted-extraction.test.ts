/**
 * pumpfun-card-restricted-extraction.test.ts
 *
 * Tests for the card-container-restricted address extraction in PumpFunPlatform.
 * Covers: card-container path, fallback path (< CARD_THRESHOLD), and
 * currentPageAddress always being the first element.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PumpFunPlatform } from '../../src/platforms/pumpfun';

// Synthetic Base58-like addresses — 44 chars each, valid Base58 charset.
// Base58 charset: 1-9, A-H, J-N, P-Z, a-k, m-z  (excludes 0, I, O, l)
// No real token addresses (ADR-002).
//
// Strategy: fixed prefix (12 safe chars) + zero-padded decimal index (3 chars
// using digits 1-9 mapped from 0-8, safe) + fill char to reach 44 total.
// Index chars: digit + 1 so digit 0→'1', 1→'2', ..., 8→'9' — all safe.

function encodeIndex3(n: number): string {
  // Encode 0..728 as 3 "base-9" digits mapped to '1'..'9'
  const d2 = Math.floor(n / 81) % 9;
  const d1 = Math.floor(n / 9) % 9;
  const d0 = n % 9;
  return `${d2 + 1}${d1 + 1}${d0 + 1}`;
}

function cardAddr(n: number): string {
  // Prefix: 'CardAddrTest' — 12 chars, all valid Base58
  // Then 3-char index, then fill '1' to reach 44
  const prefix = `CardAddrTest${encodeIndex3(n)}`;           // 15 chars
  return prefix + '1'.repeat(44 - prefix.length);
}

function streamAddr(n: number): string {
  // Prefix: 'StreamTestAddr' — 14 chars, all valid Base58
  const prefix = `StreamTestAdr${encodeIndex3(n)}`;          // 16 chars
  return prefix + '2'.repeat(44 - prefix.length);
}

// 'Page' (4) + 39 'P's + '1' = 44 chars
const PAGE_ADDR = 'Page' + 'P'.repeat(39) + '1';

describe('PumpFunPlatform.extractTokenAddresses — card-container restriction', () => {
  let platform: PumpFunPlatform;

  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: { id: 'test-extension-id', sendMessage: vi.fn() },
    });
    platform = new PumpFunPlatform();
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  // ---------------------------------------------------------------------------
  // Case 1: 50 card containers + 200 stream anchors outside → only card addrs
  // ---------------------------------------------------------------------------
  it('returns only card-container addresses when >= 3 card containers exist', () => {
    const cardCount = 50;
    const streamCount = 200;

    const cardHtml = Array.from({ length: cardCount }, (_, i) => {
      const addr = cardAddr(i);
      return `<div data-testid="coin-${addr}"><a href="/coin/${addr}">Card ${i}</a></div>`;
    }).join('');

    const streamHtml = Array.from({ length: streamCount }, (_, i) => {
      return `<a href="/coin/${streamAddr(i)}">Stream ${i}</a>`;
    }).join('');

    document.body.innerHTML = `${cardHtml}<div id="stream">${streamHtml}</div>`;

    const addresses = platform.extractTokenAddresses();

    expect(addresses).toHaveLength(cardCount);
    for (let i = 0; i < cardCount; i++) {
      expect(addresses).toContain(cardAddr(i));
    }
    for (let i = 0; i < streamCount; i++) {
      expect(addresses).not.toContain(streamAddr(i));
    }
  });

  // ---------------------------------------------------------------------------
  // Case 2: 0 card containers + 50 external anchors → fallback, all 50 returned
  // ---------------------------------------------------------------------------
  it('falls back to full scan when no card containers exist', () => {
    const streamCount = 50;

    const streamHtml = Array.from({ length: streamCount }, (_, i) => {
      return `<a href="/coin/${streamAddr(i)}">Stream ${i}</a>`;
    }).join('');

    document.body.innerHTML = `<div id="stream">${streamHtml}</div>`;

    const addresses = platform.extractTokenAddresses();

    expect(addresses).toHaveLength(streamCount);
    for (let i = 0; i < streamCount; i++) {
      expect(addresses).toContain(streamAddr(i));
    }
  });

  // ---------------------------------------------------------------------------
  // Case 3: 2 card containers (below threshold 3) + 30 external anchors → fallback
  // ---------------------------------------------------------------------------
  it('falls back to full scan when fewer than 3 card containers exist', () => {
    const cardCount = 2;
    const streamCount = 30;

    const cardHtml = Array.from({ length: cardCount }, (_, i) => {
      const addr = cardAddr(i);
      return `<div data-testid="coin-${addr}"><a href="/coin/${addr}">Card ${i}</a></div>`;
    }).join('');

    const streamHtml = Array.from({ length: streamCount }, (_, i) => {
      return `<a href="/coin/${streamAddr(i)}">Stream ${i}</a>`;
    }).join('');

    document.body.innerHTML = `${cardHtml}<div id="stream">${streamHtml}</div>`;

    const addresses = platform.extractTokenAddresses();

    // Fallback includes both card and stream addresses
    expect(addresses.length).toBeGreaterThanOrEqual(streamCount);
    for (let i = 0; i < cardCount; i++) {
      expect(addresses).toContain(cardAddr(i));
    }
    for (let i = 0; i < streamCount; i++) {
      expect(addresses).toContain(streamAddr(i));
    }
  });

  // ---------------------------------------------------------------------------
  // Case 4: currentPageAddress always first — with 50 card containers
  // ---------------------------------------------------------------------------
  it('always returns currentPageAddress as the first element on a detail page', () => {
    window.history.replaceState({}, '', `/coin/${PAGE_ADDR}`);

    const cardCount = 50;
    const cardHtml = Array.from({ length: cardCount }, (_, i) => {
      const addr = cardAddr(i);
      return `<div data-testid="coin-${addr}"><a href="/coin/${addr}">Card ${i}</a></div>`;
    }).join('');

    document.body.innerHTML = cardHtml;

    const addresses = platform.extractTokenAddresses();

    expect(addresses[0]).toBe(PAGE_ADDR);
    expect(addresses).toContain(PAGE_ADDR);
  });

  it('returns currentPageAddress first even with 0 card containers', () => {
    window.history.replaceState({}, '', `/coin/${PAGE_ADDR}`);
    document.body.innerHTML = '<div>no links here</div>';

    const addresses = platform.extractTokenAddresses();

    expect(addresses[0]).toBe(PAGE_ADDR);
    expect(addresses).toHaveLength(1);
  });
});
