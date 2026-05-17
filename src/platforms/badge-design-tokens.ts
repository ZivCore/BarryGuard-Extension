/**
 * Badge Design Tokens
 *
 * Color values originate from the Claude Design Handoff (Stripe-Variante E,
 * Floating-Variante F) and must be preserved 1:1 — no adjustments allowed.
 * No DOM access; module is independently testable.
 */

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

export const BADGE_FONT_DISPLAY = "'Inter Tight', -apple-system, sans-serif";
export const BADGE_FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeTone = 'safe' | 'caution' | 'danger';

export type BadgeToneColors = {
  fg: string;
  bg: string;
  ring: string;
};

// ---------------------------------------------------------------------------
// toneOf
// ---------------------------------------------------------------------------

export function toneOf(score: number): BadgeTone {
  if (typeof score !== 'number' || isNaN(score)) {
    return 'danger';
  }
  if (score >= 70) return 'safe';
  if (score >= 40) return 'caution';
  return 'danger';
}

// ---------------------------------------------------------------------------
// toneColors
// ---------------------------------------------------------------------------

const LIGHT_COLORS: Record<BadgeTone, BadgeToneColors> = {
  safe: {
    fg: '#0a3d20',                    // ≈ #0a3d20
    bg: 'oklch(0.92 0.10 145)',       // ≈ #d4ecd0
    ring: 'oklch(0.62 0.16 145)',     // ≈ #5fa45f
  },
  caution: {
    fg: '#5a3500',                    // ≈ #5a3500
    bg: 'oklch(0.94 0.10 80)',        // ≈ #f0e3b3
    ring: 'oklch(0.62 0.14 75)',      // ≈ #b08442
  },
  danger: {
    fg: '#5a0a0a',                    // ≈ #5a0a0a
    bg: 'oklch(0.92 0.08 25)',        // ≈ #efd2cc
    ring: 'oklch(0.58 0.20 25)',      // ≈ #c83a2f
  },
};

const DARK_COLORS: Record<BadgeTone, BadgeToneColors> = {
  safe: {
    fg: '#0a0a0a',                    // ≈ #0a0a0a
    bg: 'oklch(0.82 0.18 145)',       // ≈ #97d191
    ring: 'oklch(0.55 0.18 145)',     // ≈ #4a8a4a
  },
  caution: {
    fg: '#0a0a0a',                    // ≈ #0a0a0a
    bg: 'oklch(0.82 0.14 75)',        // ≈ #d6b876
    ring: 'oklch(0.58 0.14 75)',      // ≈ #a07a3e
  },
  danger: {
    fg: '#ffffff',                    // ≈ #ffffff
    bg: 'oklch(0.55 0.20 25)',        // ≈ #b83d33
    ring: 'oklch(0.40 0.20 25)',      // ≈ #821f1a
  },
};

export function toneColors(tone: BadgeTone, dark: boolean): BadgeToneColors {
  return dark ? DARK_COLORS[tone] : LIGHT_COLORS[tone];
}

// ---------------------------------------------------------------------------
// Verdict text
// ---------------------------------------------------------------------------

export function verdictTextStripe(tone: BadgeTone): string {
  if (tone === 'safe') return 'All clear';
  if (tone === 'caution') return 'Tread carefully';
  return 'Stand down';
}

export function verdictTextFloating(tone: BadgeTone): string {
  if (tone === 'safe') return 'CLEAR';
  if (tone === 'caution') return 'CAUTION';
  return 'DANGER';
}
