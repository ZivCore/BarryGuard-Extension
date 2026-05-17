/**
 * Badge Design Tokens
 *
 * Risk-tone palette aligned with BarryGuard web-app design system
 * (see `BarryGuard/src/app/globals.css` — --safe / --caution / --danger).
 * Soft paper-tinted backgrounds with kraeftige Ring-/Accent-Farben.
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

export type BadgeTone = 'safe' | 'caution' | 'danger' | 'neutral';

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

// Stripe-variant pastel palette — exact values from Claude Design handoff
// (`BarryGuard Badge.html` / `badge-designs.jsx` → `toneColors(tone, dark)`).
const LIGHT_COLORS: Record<BadgeTone, BadgeToneColors> = {
  safe: {
    fg: '#0a3d20',
    bg: 'oklch(0.92 0.10 145)',
    ring: 'oklch(0.62 0.16 145)',
  },
  caution: {
    fg: '#5a3500',
    bg: 'oklch(0.94 0.10 80)',
    ring: 'oklch(0.62 0.14 75)',
  },
  danger: {
    fg: '#5a0a0a',
    bg: 'oklch(0.92 0.08 25)',
    ring: 'oklch(0.58 0.20 25)',
  },
  neutral: {
    fg: '#3a2f1f',
    bg: '#f3eee2',
    ring: '#d4c8a8',
  },
};

const DARK_COLORS: Record<BadgeTone, BadgeToneColors> = {
  safe: {
    fg: '#0a0a0a',
    bg: 'oklch(0.82 0.18 145)',
    ring: 'oklch(0.55 0.18 145)',
  },
  caution: {
    fg: '#0a0a0a',
    bg: 'oklch(0.82 0.14 75)',
    ring: 'oklch(0.58 0.14 75)',
  },
  danger: {
    fg: '#ffffff',
    bg: 'oklch(0.55 0.20 25)',
    ring: 'oklch(0.40 0.20 25)',
  },
  neutral: {
    fg: '#f3eee2',
    bg: '#3a2f1f',
    ring: '#6b5a3f',
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
