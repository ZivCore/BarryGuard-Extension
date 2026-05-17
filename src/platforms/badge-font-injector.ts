/**
 * badge-font-injector.ts
 *
 * Loads badge fonts (Inter Tight, JetBrains Mono) via the FontFace API instead
 * of @font-face stylesheets. Host pages may enforce a strict Content-Security-Policy
 * that blocks injected <style> tags or stylesheet loads originating from extension
 * origins. The FontFace API bypasses this restriction by inserting fonts
 * programmatically into document.fonts (the FontFaceSet), which is not subject
 * to the host CSP.
 *
 * ADR-007: pure asset loader — no backend knowledge.
 */

let loaded = false;
let styleInjected = false;

/**
 * Plan step 4: alongside FontFace loading, inject a single
 * <style data-barryguard-fonts> element into <head>. It carries supplementary
 * CSS that augments the inline styles of the stripe badge (e.g. defensive
 * resets host pages can't override). Contains no @font-face rules — those
 * are loaded via the FontFace API to bypass host CSP.
 */
function ensureBadgeStyleInjected(): void {
  if (styleInjected) return;
  if (typeof document === 'undefined' || !document.head) return;

  const existing = document.head.querySelector('style[data-barryguard-fonts]');
  if (existing) {
    styleInjected = true;
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-barryguard-fonts', 'true');
  style.textContent = [
    // Defensive reset for badge-internal elements against aggressive host * rules
    '[data-barryguard-badge] [data-slot] {',
    '  font-style: normal !important;',
    '  text-decoration: none !important;',
    '  vertical-align: baseline;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
  styleInjected = true;
}

interface FontSpec {
  family: string;
  file: string;
  weight: string;
}

const FONT_SPECS: FontSpec[] = [
  { family: 'Inter Tight', file: 'fonts/inter-tight-700.woff2', weight: '700' },
  { family: 'Inter Tight', file: 'fonts/inter-tight-800.woff2', weight: '800' },
  { family: 'JetBrains Mono', file: 'fonts/jetbrains-mono-700.woff2', weight: '700' },
  { family: 'JetBrains Mono', file: 'fonts/jetbrains-mono-800.woff2', weight: '800' },
];

export async function ensureBadgeFontsLoaded(): Promise<void> {
  // Style element is injected regardless of font availability so the badge
  // defensive resets always apply.
  ensureBadgeStyleInjected();

  if (loaded) {
    return;
  }

  // Guard: very old browsers without FontFaceSet support
  if (typeof document === 'undefined' || !document.fonts) {
    loaded = true;
    return;
  }

  // Guard: extension runtime not available (e.g. unit test environment)
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    loaded = true;
    return;
  }

  for (const spec of FONT_SPECS) {
    const src = `url(${chrome.runtime.getURL(spec.file)}) format("woff2")`;
    const font = new FontFace(spec.family, src, {
      weight: spec.weight,
      style: 'normal',
      display: 'swap',
    });

    try {
      const loadedFace = await font.load();
      // FontFaceSet.add is part of the CSS Font Loading API but missing from
      // some lib.dom.d.ts versions — narrow via interface cast.
      const fontSet = document.fonts as unknown as {
        add(face: FontFace): void;
      };
      fontSet.add(loadedFace);
    } catch (err: unknown) {
      console.warn('[BarryGuard] Font load failed', err);
    }
  }

  loaded = true;
}
