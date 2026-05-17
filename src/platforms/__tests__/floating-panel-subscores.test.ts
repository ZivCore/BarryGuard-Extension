/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { renderFloatingPanel } from '../floating-panel';

function makeBadge(): HTMLDivElement {
  const badge = document.createElement('div');
  badge.setAttribute('data-barryguard-badge', 'TEST');
  document.body.appendChild(badge);
  return badge;
}

function fireHoverAndWait(badge: HTMLDivElement): Promise<void> {
  badge.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  return new Promise((resolve) => setTimeout(resolve, 200));
}

describe('renderFloatingPanel — subscore grid', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('omits the subscore grid entirely when subscores are missing (ADR-018)', async () => {
    const badge = makeBadge();
    renderFloatingPanel(badge, {
      score: 80,
      reasons: ['LP is locked', 'Holders look healthy'],
      dark: false,
      address: 'TEST',
    });
    await fireHoverAndWait(badge);
    const panel = document.querySelector('[data-barryguard-panel]');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).not.toContain('Contract');
    expect(panel?.textContent).not.toContain('Market');
    expect(panel?.textContent).not.toContain('Behavior');
  });

  it('omits the grid when subscores are partially numeric (only 2 of 3, ADR-018)', async () => {
    const badge = makeBadge();
    renderFloatingPanel(badge, {
      score: 60,
      reasons: ['x'],
      // behavior intentionally missing
      subscores: { contract: 80, marketStructure: 55 },
      dark: false,
      address: 'TEST',
    });
    await fireHoverAndWait(badge);
    const panel = document.querySelector('[data-barryguard-panel]');
    expect(panel?.textContent).not.toContain('Contract');
    expect(panel?.textContent).not.toContain('Market');
    expect(panel?.textContent).not.toContain('Behavior');
  });

  it('renders three subscore tiles when all three are numeric', async () => {
    const badge = makeBadge();
    renderFloatingPanel(badge, {
      score: 60,
      reasons: ['Liquidity is shallow'],
      subscores: { contract: 80, marketStructure: 55, behavior: 45 },
      dark: false,
      address: 'TEST',
    });
    await fireHoverAndWait(badge);
    const panel = document.querySelector('[data-barryguard-panel]');
    expect(panel?.textContent).toContain('Contract');
    expect(panel?.textContent).toContain('Market');
    expect(panel?.textContent).toContain('Behavior');
    expect(panel?.textContent).toContain('80');
    expect(panel?.textContent).toContain('55');
    expect(panel?.textContent).toContain('45');
  });

  it('omits the bullet block when reasons are empty (ADR-018)', async () => {
    const badge = makeBadge();
    renderFloatingPanel(badge, {
      score: 85,
      reasons: [],
      dark: false,
      address: 'TEST',
    });
    await fireHoverAndWait(badge);
    const panel = document.querySelector('[data-barryguard-panel]');
    expect(panel?.textContent).not.toContain('No major concerns detected');
  });

  it('renders footer link with exact label', async () => {
    const badge = makeBadge();
    renderFloatingPanel(badge, {
      score: 80,
      reasons: ['ok'],
      dark: false,
      address: 'TEST',
    });
    await fireHoverAndWait(badge);
    const footer = document.querySelector('[data-barryguard-footer]');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('View full report');
  });
});
