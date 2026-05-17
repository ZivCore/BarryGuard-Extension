/**
 * host-theme.ts
 * Detects the host page's light/dark theme for badge palette selection.
 * Plan step 5 — badge-design-e-stripe.
 */

export type HostTheme = 'light' | 'dark';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parse `rgb(r, g, b)` or `rgba(r, g, b, a)` strings. Returns null on failure. */
function parseRgba(value: string): RgbaColor | null {
  const rgba = value.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/,
  );
  if (!rgba) return null;

  const r = parseInt(rgba[1], 10);
  const g = parseInt(rgba[2], 10);
  const b = parseInt(rgba[3], 10);
  const a = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1;

  if (
    r < 0 || r > 255 ||
    g < 0 || g > 255 ||
    b < 0 || b > 255 ||
    a < 0 || a > 1
  ) return null;

  return { r, g, b, a };
}

/** Linearise a single 0-255 channel value per WCAG sRGB formula. */
function linearise(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance from an RgbaColor. */
function relativeLuminance(color: RgbaColor): number {
  return (
    0.2126 * linearise(color.r) +
    0.7152 * linearise(color.g) +
    0.0722 * linearise(color.b)
  );
}

/** Theme from system preference, with a safe fallback. */
function systemTheme(): HostTheme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

// ---------------------------------------------------------------------------
// Pure computation
// ---------------------------------------------------------------------------

const MAX_ANCESTOR_WALK = 6;

/**
 * Determine the host theme by walking up to 6 ancestors of `target`,
 * reading `backgroundColor`, and computing WCAG luminance.
 * No cache; always does DOM reads.
 */
export function detectHostThemeAt(target: HTMLElement): HostTheme {
  let node: Element | null = target;
  let steps = 0;

  while (node !== null && steps < MAX_ANCESTOR_WALK) {
    try {
      const bg = getComputedStyle(node).backgroundColor;
      const color = parseRgba(bg);

      if (color !== null && color.a > 0) {
        const lum = relativeLuminance(color);
        return lum < 0.5 ? 'dark' : 'light';
      }
    } catch {
      // getComputedStyle or parseRgba failed — skip this node
    }

    node = node.parentElement;
    steps++;
  }

  return systemTheme();
}

// ---------------------------------------------------------------------------
// Cached wrapper with MutationObserver invalidation
// ---------------------------------------------------------------------------

const themeCache = new WeakMap<HTMLElement, HostTheme>();
let observerInstalled = false;

function installObserver(): void {
  if (observerInstalled) return;
  observerInstalled = true;

  const observer = new MutationObserver(() => {
    if (document.body) {
      themeCache.delete(document.body);
    }
  });

  const targets: Array<Element | null> = [
    document.documentElement,
    document.body,
  ];

  for (const el of targets) {
    if (el) {
      observer.observe(el, {
        attributes: true,
        attributeFilter: ['class', 'data-theme', 'style'],
      });
    }
  }
}

/**
 * Like `detectHostThemeAt` but memoises the result keyed on `document.body`.
 * Cache is invalidated automatically when `<html>` or `<body>` class/data-theme/style changes.
 */
export function detectHostThemeCached(target: HTMLElement): HostTheme {
  if (!document.body) {
    return detectHostThemeAt(target);
  }

  installObserver();

  const cached = themeCache.get(document.body);
  if (cached !== undefined) {
    return cached;
  }

  const theme = detectHostThemeAt(target);
  themeCache.set(document.body, theme);
  return theme;
}
