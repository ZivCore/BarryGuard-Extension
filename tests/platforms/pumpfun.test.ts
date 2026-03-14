// tests/platforms/pumpfun.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { PumpFunPlatform } from '../../src/platforms/pumpfun';

describe('PumpFunPlatform.extractTokenAddresses', () => {
  let platform: PumpFunPlatform;

  beforeEach(() => {
    platform = new PumpFunPlatform();
    document.body.innerHTML = '';
  });

  it('extracts valid Solana addresses from /coin/ links', () => {
    document.body.innerHTML = `
      <a href="/coin/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU">Token A</a>
      <a href="/coin/So11111111111111111111111111111111111111112">Token B</a>
    `;
    const addresses = platform.extractTokenAddresses();
    expect(addresses).toHaveLength(2);
    expect(addresses[0]).toBe('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
    expect(addresses[1]).toBe('So11111111111111111111111111111111111111112');
  });

  it('deduplicates addresses that appear multiple times', () => {
    document.body.innerHTML = `
      <a href="/coin/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU">Token A</a>
      <a href="/coin/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU">Token A (again)</a>
    `;
    const addresses = platform.extractTokenAddresses();
    expect(addresses).toHaveLength(1);
  });

  it('ignores links that are not /coin/ routes', () => {
    document.body.innerHTML = `
      <a href="/profile/someuser">Profile</a>
      <a href="/about">About</a>
    `;
    expect(platform.extractTokenAddresses()).toHaveLength(0);
  });

  it('ignores /coin/ links with invalid addresses (too short)', () => {
    document.body.innerHTML = `<a href="/coin/abc123">Invalid</a>`;
    expect(platform.extractTokenAddresses()).toHaveLength(0);
  });

  it('returns empty array when no token links present', () => {
    document.body.innerHTML = '<div>No tokens here</div>';
    expect(platform.extractTokenAddresses()).toHaveLength(0);
  });
});
