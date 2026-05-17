/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectHostThemeAt, detectHostThemeCached } from '../host-theme';

function mkLeaf(): HTMLElement {
  document.body.innerHTML = '';
  const wrap = document.createElement('div');
  const leaf = document.createElement('span');
  wrap.appendChild(leaf);
  document.body.appendChild(wrap);
  return leaf;
}

describe('detectHostThemeAt', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.removeAttribute('style');
    document.documentElement.removeAttribute('class');
  });

  it('returns dark when an ancestor has a dark backgroundColor', () => {
    const leaf = mkLeaf();
    (leaf.parentElement as HTMLElement).style.backgroundColor = 'rgb(10, 10, 10)';
    expect(detectHostThemeAt(leaf)).toBe('dark');
  });

  it('returns light when an ancestor has a light backgroundColor', () => {
    const leaf = mkLeaf();
    (leaf.parentElement as HTMLElement).style.backgroundColor = 'rgb(245, 245, 245)';
    expect(detectHostThemeAt(leaf)).toBe('light');
  });

  it('falls back to matchMedia prefers-color-scheme when no ancestor has a coloured background', () => {
    const leaf = mkLeaf();
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });
    expect(detectHostThemeAt(leaf)).toBe('dark');
  });

  it('defaults to light if everything fails', () => {
    const leaf = mkLeaf();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error('boom');
      },
    });
    expect(detectHostThemeAt(leaf)).toBe('light');
  });
});

describe('detectHostThemeCached', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.body.removeAttribute('style');
  });

  afterEach(() => {
    document.body.removeAttribute('style');
  });

  it('returns cached value on second call when no mutation occurred', () => {
    const leaf = mkLeaf();
    (leaf.parentElement as HTMLElement).style.backgroundColor = 'rgb(10, 10, 10)';
    const first = detectHostThemeCached(leaf);
    const second = detectHostThemeCached(leaf);
    expect(first).toBe(second);
  });

  it('invalidates memo when <html> class attribute mutates', async () => {
    const leaf = mkLeaf();
    (leaf.parentElement as HTMLElement).style.backgroundColor = 'rgb(10, 10, 10)';
    const first = detectHostThemeCached(leaf);
    expect(first).toBe('dark');

    // Now flip the host: light bg + class mutation on <html>
    (leaf.parentElement as HTMLElement).style.backgroundColor = 'rgb(245, 245, 245)';
    document.documentElement.setAttribute('class', 'theme-light');

    // Wait a microtask for MutationObserver to fire
    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = detectHostThemeCached(leaf);
    expect(second).toBe('light');
  });

  it('falls back to detectHostThemeAt when document.body is missing', () => {
    const leaf = mkLeaf();
    const originalBody = document.body;
    Object.defineProperty(document, 'body', {
      configurable: true,
      value: null,
    });
    try {
      expect(detectHostThemeCached(leaf)).toBeDefined();
    } finally {
      Object.defineProperty(document, 'body', {
        configurable: true,
        value: originalBody,
      });
    }
  });
});
