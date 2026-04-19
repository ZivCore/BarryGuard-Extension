import { describe, it, expect } from 'vitest';
import { buildCheckUrl } from '../../src/shared/check-url';

describe('buildCheckUrl', () => {
  describe('happy path', () => {
    it('builds url for solana', () => {
      expect(
        buildCheckUrl('solana', 'So11111111111111111111111111111111111111112'),
      ).toBe(
        'https://barryguard.com/check/solana/So11111111111111111111111111111111111111112',
      );
    });

    it('builds url for ethereum', () => {
      expect(
        buildCheckUrl('ethereum', '0xdAC17F958D2ee523a2206206994597C13D831ec7'),
      ).toBe(
        'https://barryguard.com/check/ethereum/0xdAC17F958D2ee523a2206206994597C13D831ec7',
      );
    });

    it('builds url for bsc', () => {
      expect(
        buildCheckUrl('bsc', '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82'),
      ).toBe(
        'https://barryguard.com/check/bsc/0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      );
    });

    it('builds url for base', () => {
      expect(
        buildCheckUrl('base', '0x4200000000000000000000000000000000000006'),
      ).toBe(
        'https://barryguard.com/check/base/0x4200000000000000000000000000000000000006',
      );
    });

    it('normalizes chain to lowercase, preserves address case', () => {
      expect(buildCheckUrl('ETHEREUM', '0xAbC')).toBe(
        'https://barryguard.com/check/ethereum/0xAbC',
      );
    });

    it('address case is preserved (mixed-case EVM checksum address unchanged)', () => {
      const result = buildCheckUrl(
        'ethereum',
        '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      );
      expect(result).not.toBeNull();
      expect(result!.endsWith('/0xdAC17F958D2ee523a2206206994597C13D831ec7')).toBe(true);
    });
  });

  describe('strict degraded path', () => {
    it('returns null for undefined chain', () => {
      expect(
        buildCheckUrl(undefined, '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82'),
      ).toBeNull();
    });

    it('returns null for null chain', () => {
      expect(
        buildCheckUrl(null, 'So11111111111111111111111111111111111111112'),
      ).toBeNull();
    });

    it('returns null for empty string chain', () => {
      expect(buildCheckUrl('', '0xAbC')).toBeNull();
    });

    it('returns null for unsupported chain', () => {
      expect(buildCheckUrl('polygon', '0xAbC')).toBeNull();
    });

    it('returns null for empty address', () => {
      expect(buildCheckUrl('solana', '')).toBeNull();
    });
  });

  describe('regression guards', () => {
    it('does not fall back to ethereum for unknown chain with 0x address', () => {
      const result = buildCheckUrl(
        undefined,
        '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      );
      expect(result).not.toBe(
        'https://barryguard.com/check/ethereum/0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      );
      expect(result).toBeNull();
    });
  });
});
