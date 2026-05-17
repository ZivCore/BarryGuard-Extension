/**
 * Regression-guard: web_accessible_resources MUST be scoped to
 * PLATFORM_HOST_PATTERNS (NOT '<all_urls>') to prevent install-fingerprinting
 * via probe requests on stable chrome-extension:// URLs.
 *
 * Codex adversarial review finding 2026-05-17.
 *
 * Implementation note: wxt.config.ts cannot be imported under Vitest's esbuild
 * transform pipeline (env mismatch). We assert against the source text instead.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONFIG_PATH = resolve(__dirname, '..', '..', 'wxt.config.ts');
const CONFIG_SRC = readFileSync(CONFIG_PATH, 'utf-8');

describe('manifest web_accessible_resources', () => {
  it('declares web_accessible_resources in wxt.config.ts', () => {
    expect(CONFIG_SRC).toMatch(/web_accessible_resources\s*:/);
  });

  it('lists all five badge assets (4 fonts + logo)', () => {
    expect(CONFIG_SRC).toContain('fonts/inter-tight-700.woff2');
    expect(CONFIG_SRC).toContain('fonts/inter-tight-800.woff2');
    expect(CONFIG_SRC).toContain('fonts/jetbrains-mono-700.woff2');
    expect(CONFIG_SRC).toContain('fonts/jetbrains-mono-800.woff2');
    expect(CONFIG_SRC).toContain('badge/barryguard-logo.png');
  });

  it('does NOT use <all_urls> in any matches: assignment (install-fingerprinting guard)', () => {
    // Comments may reference <all_urls> documentation-wise; production
    // matches: declarations must not.
    const matchesLines = CONFIG_SRC.split('\n').filter((l) =>
      /^\s*matches\s*:/.test(l),
    );
    expect(matchesLines.length).toBeGreaterThan(0);
    for (const line of matchesLines) {
      expect(line).not.toContain('<all_urls>');
    }
  });

  it('uses PLATFORM_HOST_PATTERNS as the matches list source', () => {
    expect(CONFIG_SRC).toMatch(/matches\s*:\s*\[\s*\.\.\.PLATFORM_HOST_PATTERNS\s*\]/);
  });
});
