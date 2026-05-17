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

const LIGHT_COLORS: Record<BadgeTone, BadgeToneColors> = {
  safe: {
    fg: 'oklch(0.20 0 0)',            // BarryGuard --ink
    bg: 'oklch(0.95 0.04 145)',       // BarryGuard --safe-bg (paper-tinted green)
    ring: 'oklch(0.58 0.13 145)',     // BarryGuard --safe
  },
  caution: {
    fg: 'oklch(0.20 0 0)',            // BarryGuard --ink
    bg: 'oklch(0.96 0.05 80)',        // BarryGuard --caution-bg (paper-tinted amber)
    ring: 'oklch(0.72 0.14 75)',      // BarryGuard --caution
  },
  danger: {
    fg: 'oklch(0.20 0 0)',            // BarryGuard --ink
    bg: 'oklch(0.95 0.04 25)',        // BarryGuard --danger-bg (paper-tinted rose)
    ring: 'oklch(0.56 0.18 25)',      // BarryGuard --danger
  },
  neutral: {
    fg: '#3a2f1f',                    // dark warm ink for contrast on paper-cream
    bg: '#f3eee2',                    // BarryGuard paper-cream (X_PALETTE.paper)
    ring: '#d4c8a8',                  // muted beige border, ~20% darker than bg
  },
};

const DARK_COLORS: Record<BadgeTone, BadgeToneColors> = {
  safe: {
    fg: 'oklch(0.95 0 0)',            // BarryGuard --ink (dark mode)
    bg: 'oklch(0.28 0.05 145)',       // BarryGuard --safe-bg (dark mode)
    ring: 'oklch(0.72 0.14 145)',     // BarryGuard --safe (dark mode)
  },
  caution: {
    fg: 'oklch(0.95 0 0)',            // BarryGuard --ink (dark mode)
    bg: 'oklch(0.30 0.06 80)',        // BarryGuard --caution-bg (dark mode)
    ring: 'oklch(0.78 0.14 75)',      // BarryGuard --caution (dark mode)
  },
  danger: {
    fg: 'oklch(0.95 0 0)',            // BarryGuard --ink (dark mode)
    bg: 'oklch(0.30 0.06 25)',        // BarryGuard --danger-bg (dark mode)
    ring: 'oklch(0.68 0.18 25)',      // BarryGuard --danger (dark mode)
  },
  neutral: {
    fg: '#f3eee2',                    // paper-cream as foreground on dark
    bg: '#3a2f1f',                    // inverted dark warm for dark mode
    ring: '#6b5a3f',                  // muted warm border
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
