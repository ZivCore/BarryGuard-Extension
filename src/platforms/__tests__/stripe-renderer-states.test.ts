/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createBadgeElement, renderStripeBadge } from '../platform-utils';

beforeEach(() => {
  document.body.innerHTML = '';
});

function getVerdict(badge: HTMLDivElement): string {
  return badge.querySelector<HTMLSpanElement>('[data-slot="verdict"]')?.textContent ?? '';
}

function getScoreSlot(badge: HTMLDivElement): string {
  return badge.querySelector<HTMLSpanElement>('[data-slot="score"]')?.textContent ?? '';
}

describe('renderStripeBadge — five states', () => {
  it('renders scored state with Low Risk verdict (risk=low)', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'scored', score: 92, risk: 'low', dark: false });
    expect(getVerdict(badge)).toBe('Low Risk');
    expect(getScoreSlot(badge)).toBe('92');
    expect(badge.style.width).toBe('220px');
  });

  it('renders scored state with Moderate verdict (risk=moderate)', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'scored', score: 82, risk: 'moderate', dark: false });
    expect(getVerdict(badge)).toBe('Moderate');
    expect(getScoreSlot(badge)).toBe('82');
  });

  it('renders scored state with Caution verdict (risk=caution)', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'scored', score: 55, risk: 'caution', dark: false });
    expect(getVerdict(badge)).toBe('Caution');
    expect(getScoreSlot(badge)).toBe('55');
  });

  it('renders scored state with High Risk verdict (risk=high)', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'scored', score: 40, risk: 'high', dark: false });
    expect(getVerdict(badge)).toBe('High Risk');
    expect(getScoreSlot(badge)).toBe('40');
  });

  it('renders scored state with Danger verdict (risk=danger)', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'scored', score: 15, risk: 'danger', dark: false });
    expect(getVerdict(badge)).toBe('Danger');
    expect(getScoreSlot(badge)).toBe('15');
  });

  it('falls back to score-based risk when risk field absent (score 82 → Moderate)', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'scored', score: 82, dark: false });
    expect(getVerdict(badge)).toBe('Moderate');
    expect(getScoreSlot(badge)).toBe('82');
  });

  it('renders compact width when compact=true', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'scored', score: 92, risk: 'low', dark: false, compact: true });
    expect(badge.style.width).toBe('160px');
  });

  it('renders loading state', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'loading', dark: false });
    expect(getVerdict(badge)).toBe('Analyzing');
    expect(getScoreSlot(badge)).toBe('·');
    expect(badge.style.cursor).toBe('default');
  });

  it('loading state uses neutral paper-cream (#f3eee2), not caution or safe palette', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'loading', dark: false });
    // jsdom normalizes #f3eee2 to rgb(243, 238, 226). Accept either form.
    const bg = badge.style.background.toLowerCase().replace(/\s+/g, '');
    const isPaperCream =
      bg.includes('#f3eee2') || bg.includes('rgb(243,238,226)');
    expect(isPaperCream).toBe(true);
    expect(bg).not.toMatch(/oklch\([^)]*\b80\)/);
    expect(bg).not.toMatch(/oklch\([^)]*\b145\)/);
  });

  it('renders error state', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'error', dark: false });
    expect(getVerdict(badge)).toBe('Unavailable');
    expect(getScoreSlot(badge)).toBe('?');
    expect(badge.style.cursor).toBe('default');
  });

  it('renders locked-quota state', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'locked-quota', dark: false });
    expect(getVerdict(badge)).toBe('Limit reached');
    expect(getScoreSlot(badge)).toBe('\u{1F512}');
    expect(badge.style.cursor).toBe('default');
  });

  it('renders locked-anonymous state with exact ADR-020 CTA', () => {
    const badge = createBadgeElement('TEST');
    renderStripeBadge(badge, { state: 'locked-anonymous', dark: false });
    expect(getVerdict(badge)).toBe('Sign up free to see all checks');
    expect(getScoreSlot(badge)).toBe('\u{1F512}');
    expect(badge.style.cursor).toBe('pointer');
  });

  it('locked-anonymous installs a click handler that fires safeSendPopupMessage', () => {
    const badge = createBadgeElement('TEST_ADDR');
    renderStripeBadge(badge, { state: 'locked-anonymous', dark: false });
    expect(typeof badge.onclick).toBe('function');
  });
});
