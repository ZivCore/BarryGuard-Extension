/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('badge-font-injector', () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('is a no-op when document.fonts is missing', async () => {
    const original = (document as unknown as { fonts?: unknown }).fonts;
    try {
      delete (document as unknown as { fonts?: unknown }).fonts;
      const mod = await import('../badge-font-injector');
      await expect(mod.ensureBadgeFontsLoaded()).resolves.toBeUndefined();
    } finally {
      (document as unknown as { fonts?: unknown }).fonts = original;
    }
  });

  it('is a no-op when chrome.runtime is missing', async () => {
    const mod = await import('../badge-font-injector');
    await expect(mod.ensureBadgeFontsLoaded()).resolves.toBeUndefined();
  });

  it('does not throw on second invocation (idempotent singleton)', async () => {
    const mod = await import('../badge-font-injector');
    await mod.ensureBadgeFontsLoaded();
    await expect(mod.ensureBadgeFontsLoaded()).resolves.toBeUndefined();
  });

  it('injects exactly one <style data-barryguard-fonts> element into <head>', async () => {
    const mod = await import('../badge-font-injector');
    await mod.ensureBadgeFontsLoaded();
    await mod.ensureBadgeFontsLoaded();
    const styleEls = document.head.querySelectorAll('style[data-barryguard-fonts]');
    expect(styleEls.length).toBe(1);
  });
});
