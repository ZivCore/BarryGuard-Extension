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
    const oklchTones: BadgeTone[] = ['safe', 'caution', 'danger'];
    const allTones: BadgeTone[] = ['safe', 'caution', 'danger', 'neutral'];

    it.each(oklchTones)('returns oklch palette for %s when dark=false', (tone) => {
      const c = toneColors(tone, false);
      expect(c.fg).toMatch(/^oklch\(/);
      expect(c.bg).toMatch(/^oklch\(/);
      expect(c.ring).toMatch(/^oklch\(/);
    });

    it.each(oklchTones)('returns oklch palette for %s when dark=true', (tone) => {
      const c = toneColors(tone, true);
      expect(c.fg).toMatch(/^oklch\(/);
      expect(c.bg).toMatch(/^oklch\(/);
      expect(c.ring).toMatch(/^oklch\(/);
    });

    it.each(allTones)('returns a defined record for %s in both modes', (tone) => {
      expect(toneColors(tone, false)).toBeDefined();
      expect(toneColors(tone, true)).toBeDefined();
    });

    it('returns BarryGuard web-app token values for safe light', () => {
      const c = toneColors('safe', false);
      expect(c.bg).toBe('oklch(0.95 0.04 145)');
      expect(c.ring).toBe('oklch(0.58 0.13 145)');
      expect(c.fg).toBe('oklch(0.20 0 0)');
    });

    it('returns BarryGuard web-app token values for danger dark', () => {
      const c = toneColors('danger', true);
      expect(c.bg).toBe('oklch(0.30 0.06 25)');
      expect(c.ring).toBe('oklch(0.68 0.18 25)');
      expect(c.fg).toBe('oklch(0.95 0 0)');
    });

    it('returns BarryGuard paper-cream for neutral light', () => {
      const c = toneColors('neutral', false);
      expect(c.bg).toBe('#f3eee2');
      expect(c.fg).toBe('#3a2f1f');
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
