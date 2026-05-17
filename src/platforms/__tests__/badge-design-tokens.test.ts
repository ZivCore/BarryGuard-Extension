import { describe, expect, it } from 'vitest';
import {
  BADGE_FONT_DISPLAY,
  BADGE_FONT_MONO,
  toneColors,
  toneOf,
  verdictTextFloating,
  verdictTextStripe,
  type BadgeTone,
} from '../badge-design-tokens';

describe('badge-design-tokens', () => {
  describe('toneOf', () => {
    it('returns safe for score >= 70', () => {
      expect(toneOf(70)).toBe('safe');
      expect(toneOf(100)).toBe('safe');
    });

    it('returns caution for score in 40-69', () => {
      expect(toneOf(40)).toBe('caution');
      expect(toneOf(55)).toBe('caution');
      expect(toneOf(69)).toBe('caution');
    });

    it('returns danger for score < 40', () => {
      expect(toneOf(39)).toBe('danger');
      expect(toneOf(0)).toBe('danger');
    });

    it('defends against NaN/non-number', () => {
      expect(toneOf(NaN)).toBe('danger');
      // @ts-expect-error testing defensive path
      expect(toneOf(undefined)).toBe('danger');
    });
  });

  describe('toneColors', () => {
    const tones: BadgeTone[] = ['safe', 'caution', 'danger'];

    it.each(tones)('returns light palette for %s when dark=false', (tone) => {
      const c = toneColors(tone, false);
      expect(c.fg).toMatch(/^#/);
      expect(c.bg).toMatch(/^oklch\(/);
      expect(c.ring).toMatch(/^oklch\(/);
    });

    it.each(tones)('returns dark palette for %s when dark=true', (tone) => {
      const c = toneColors(tone, true);
      expect(c.fg).toMatch(/^#/);
      expect(c.bg).toMatch(/^oklch\(/);
      expect(c.ring).toMatch(/^oklch\(/);
    });

    it('returns 1:1 oklch values from the Claude design (safe light)', () => {
      const c = toneColors('safe', false);
      expect(c.bg).toBe('oklch(0.92 0.10 145)');
      expect(c.ring).toBe('oklch(0.62 0.16 145)');
      expect(c.fg).toBe('#0a3d20');
    });

    it('returns 1:1 oklch values from the Claude design (danger dark)', () => {
      const c = toneColors('danger', true);
      expect(c.bg).toBe('oklch(0.55 0.20 25)');
      expect(c.ring).toBe('oklch(0.40 0.20 25)');
      expect(c.fg).toBe('#ffffff');
    });
  });

  describe('verdictTextStripe', () => {
    it('returns exact stripe-variant strings', () => {
      expect(verdictTextStripe('safe')).toBe('All clear');
      expect(verdictTextStripe('caution')).toBe('Tread carefully');
      expect(verdictTextStripe('danger')).toBe('Stand down');
    });
  });

  describe('verdictTextFloating', () => {
    it('returns exact floating-variant strings', () => {
      expect(verdictTextFloating('safe')).toBe('CLEAR');
      expect(verdictTextFloating('caution')).toBe('CAUTION');
      expect(verdictTextFloating('danger')).toBe('DANGER');
    });
  });

  describe('font constants', () => {
    it('exposes Inter Tight as display font', () => {
      expect(BADGE_FONT_DISPLAY).toContain('Inter Tight');
    });
    it('exposes JetBrains Mono as mono font', () => {
      expect(BADGE_FONT_MONO).toContain('JetBrains Mono');
    });
  });
});
