import { describe, expect, it } from 'vitest';
import {
  BADGE_FONT_DISPLAY,
  BADGE_FONT_MONO,
  toneColors,
  toneOf,
  verdictTextFloating,
  verdictTextFromRisk,
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

    it.each(oklchTones)('returns oklch bg/ring palette for %s when dark=false', (tone) => {
      const c = toneColors(tone, false);
      expect(c.bg).toMatch(/^oklch\(/);
      expect(c.ring).toMatch(/^oklch\(/);
    });

    it.each(oklchTones)('returns oklch bg/ring palette for %s when dark=true', (tone) => {
      const c = toneColors(tone, true);
      expect(c.bg).toMatch(/^oklch\(/);
      expect(c.ring).toMatch(/^oklch\(/);
    });

    it.each(allTones)('returns a defined record for %s in both modes', (tone) => {
      expect(toneColors(tone, false)).toBeDefined();
      expect(toneColors(tone, true)).toBeDefined();
    });

    // Stripe-variant pastel palette — see `badge-design-tokens.ts` comment.
    it('returns Stripe pastel values for safe light', () => {
      const c = toneColors('safe', false);
      expect(c.bg).toBe('oklch(0.92 0.10 145)');
      expect(c.ring).toBe('oklch(0.62 0.16 145)');
      expect(c.fg).toBe('#0a3d20');
    });

    it('returns Stripe pastel values for caution light', () => {
      const c = toneColors('caution', false);
      expect(c.bg).toBe('oklch(0.94 0.10 80)');
      expect(c.ring).toBe('oklch(0.62 0.14 75)');
      expect(c.fg).toBe('#5a3500');
    });

    it('returns Stripe pastel values for danger light', () => {
      const c = toneColors('danger', false);
      expect(c.bg).toBe('oklch(0.92 0.08 25)');
      expect(c.ring).toBe('oklch(0.58 0.20 25)');
      expect(c.fg).toBe('#5a0a0a');
    });

    it('returns Stripe palette values for danger dark', () => {
      const c = toneColors('danger', true);
      expect(c.bg).toBe('oklch(0.55 0.20 25)');
      expect(c.ring).toBe('oklch(0.40 0.20 25)');
      expect(c.fg).toBe('#ffffff');
    });

    it('returns BarryGuard paper-cream for neutral light', () => {
      const c = toneColors('neutral', false);
      expect(c.bg).toBe('#f3eee2');
      expect(c.fg).toBe('#3a2f1f');
    });
  });

  describe('verdictTextFromRisk', () => {
    it('maps danger → Danger', () => {
      expect(verdictTextFromRisk('danger')).toBe('Danger');
    });
    it('maps high → High Risk', () => {
      expect(verdictTextFromRisk('high')).toBe('High Risk');
    });
    it('maps caution → Caution', () => {
      expect(verdictTextFromRisk('caution')).toBe('Caution');
    });
    it('maps moderate → Moderate', () => {
      expect(verdictTextFromRisk('moderate')).toBe('Moderate');
    });
    it('maps medium → Caution (backward compat)', () => {
      expect(verdictTextFromRisk('medium')).toBe('Caution');
    });
    it('maps low → Low Risk', () => {
      expect(verdictTextFromRisk('low')).toBe('Low Risk');
    });
    it('maps unknown string → Unknown Risk', () => {
      expect(verdictTextFromRisk('foobar')).toBe('Unknown Risk');
    });
  });

  describe('verdictTextStripe (backward compat)', () => {
    it('returns exact stripe-variant strings', () => {
      expect(verdictTextStripe('safe')).toBe('All clear');
      expect(verdictTextStripe('caution')).toBe('Tread carefully');
      expect(verdictTextStripe('danger')).toBe('Stand down');
    });
  });

  describe('verdictTextFloating (backward compat)', () => {
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
