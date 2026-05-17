/**
 * Floating Detail Panel — Design F aus Claude-Design-Handoff (1:1).
 *
 * Ersetzt das alte dunkle Tooltip mit der BarryGuard-Floating-Panel-Variante.
 * Singleton-DOM unter <body>, replaceChildren-Rendering, Listener-Re-Attach
 * pro Render-Iteration. ADR-018: leere/fehlende Bloecke werden weggelassen,
 * kein Pseudo-Text. ADR-007: rein Display, keine Backend-Logik.
 */

import {
  BADGE_FONT_DISPLAY,
  BADGE_FONT_MONO,
  toneColors,
  toneOf,
  verdictTextFloating,
  type BadgeTone,
} from './badge-design-tokens';

export interface FloatingPanelSubscores {
  contract?: number;
  marketStructure?: number;
  behavior?: number;
}

export interface RenderFloatingPanelParams {
  score: number;
  reasons: string[];
  subscores?: FloatingPanelSubscores;
  coverageRisk?: string | null;
  dark: boolean;
  address: string;
}

const PANEL_WIDTH = 296;
const HIDE_DELAY_MS = 200;
const SHOW_DELAY_MS = 150;

// Singleton panel + lifecycle state
let panelEl: HTMLDivElement | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleHide(): void {
  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    if (panelEl) panelEl.style.display = 'none';
    hideTimeout = null;
  }, HIDE_DELAY_MS);
}

function cancelHide(): void {
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

function ensurePanel(): HTMLDivElement {
  // Re-create if previously detached (e.g. test resets, page navigation)
  if (panelEl && document.body && document.body.contains(panelEl)) {
    return panelEl;
  }

  const el = document.createElement('div');
  el.setAttribute('data-barryguard-panel', 'true');
  el.style.cssText = [
    'position:fixed',
    'display:none',
    `width:${PANEL_WIDTH}px`,
    'border-radius:12px',
    'overflow:hidden',
    `font-family:${BADGE_FONT_DISPLAY}`,
    'z-index:2147483646',
    'box-sizing:border-box',
    'box-shadow:0 12px 32px rgba(0,0,0,0.20), 0 2px 8px rgba(0,0,0,0.08)',
  ].join(';');

  el.addEventListener('mouseenter', cancelHide);
  el.addEventListener('mouseleave', scheduleHide);

  document.body.appendChild(el);
  panelEl = el;
  return el;
}

function setReset(node: HTMLElement): void {
  node.style.margin = '0';
  node.style.padding = '0';
  node.style.border = '0';
  node.style.background = 'transparent';
  node.style.boxShadow = 'none';
  node.style.textDecoration = 'none';
  node.style.boxSizing = 'border-box';
}

function sendOpenAnalysisMessage(address: string): void {
  // Inline thin wrapper to avoid circular import with platform-utils.ts.
  // Mirrors safeSendPopupMessage; errors are swallowed when extension
  // context is invalidated.
  try {
    if (!chrome?.runtime?.id) return;
    chrome.runtime.sendMessage(
      { type: 'OPEN_POPUP_FOR_TOKEN', payload: { address } },
      () => {
        const err = chrome.runtime.lastError?.message;
        if (err && !err.toLowerCase().includes('extension context invalidated')) {
          console.error('[BarryGuard] Floating panel action failed:', err);
        }
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.toLowerCase().includes('extension context invalidated')) {
      throw err;
    }
  }
}

function buildHeader(
  tone: BadgeTone,
  score: number,
  dark: boolean,
): HTMLDivElement {
  const ringColor = toneColors(tone, dark).ring;

  const header = document.createElement('div');
  setReset(header);
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '10px';
  header.style.padding = '11px 13px';
  header.style.background = ringColor;
  header.style.color = '#ffffff';

  // Logo tile
  const tile = document.createElement('span');
  setReset(tile);
  tile.style.display = 'inline-flex';
  tile.style.alignItems = 'center';
  tile.style.justifyContent = 'center';
  tile.style.width = '34px';
  tile.style.height = '34px';
  tile.style.borderRadius = '9px';
  tile.style.background = 'rgba(255,255,255,0.18)';
  tile.style.padding = '3px';
  tile.style.flexShrink = '0';

  const logo = document.createElement('img');
  logo.alt = '';
  logo.width = 28;
  logo.height = 28;
  logo.style.cssText = 'display:block;width:28px;height:28px;border:0;';
  try {
    logo.src = chrome.runtime.getURL('badge/barryguard-logo.png');
  } catch {
    // chrome.runtime not available — leave empty
  }
  tile.appendChild(logo);
  header.appendChild(tile);

  // Label block
  const labelBlock = document.createElement('div');
  setReset(labelBlock);
  labelBlock.style.flex = '1';
  labelBlock.style.display = 'flex';
  labelBlock.style.flexDirection = 'column';
  labelBlock.style.gap = '1px';

  const kicker = document.createElement('span');
  setReset(kicker);
  kicker.style.fontSize = '9px';
  kicker.style.fontWeight = '700';
  kicker.style.letterSpacing = '1.4px';
  kicker.style.textTransform = 'uppercase';
  kicker.style.opacity = '0.75';
  kicker.textContent = 'BarryGuard · Risk';
  labelBlock.appendChild(kicker);

  const verdict = document.createElement('span');
  setReset(verdict);
  verdict.style.fontSize = '14px';
  verdict.style.fontWeight = '800';
  verdict.style.letterSpacing = '-0.2px';
  verdict.textContent = verdictTextFloating(tone);
  labelBlock.appendChild(verdict);

  header.appendChild(labelBlock);

  // Score block (right)
  const scoreBlock = document.createElement('span');
  setReset(scoreBlock);
  scoreBlock.style.display = 'flex';
  scoreBlock.style.flexDirection = 'column';
  scoreBlock.style.alignItems = 'flex-end';
  scoreBlock.style.gap = '1px';

  const scoreNum = document.createElement('span');
  setReset(scoreNum);
  scoreNum.style.fontFamily = BADGE_FONT_MONO;
  scoreNum.style.fontWeight = '800';
  scoreNum.style.fontSize = '26px';
  scoreNum.style.letterSpacing = '-1.4px';
  scoreNum.style.lineHeight = '1';
  scoreNum.textContent = String(score);
  scoreBlock.appendChild(scoreNum);

  const scoreDenom = document.createElement('span');
  setReset(scoreDenom);
  scoreDenom.style.fontSize = '8.5px';
  scoreDenom.style.fontWeight = '700';
  scoreDenom.style.opacity = '0.7';
  scoreDenom.style.letterSpacing = '0.6px';
  scoreDenom.textContent = '/ 100';
  scoreBlock.appendChild(scoreDenom);

  header.appendChild(scoreBlock);

  return header;
}

function buildSubscoreGrid(
  subscores: FloatingPanelSubscores,
  dark: boolean,
): HTMLDivElement | null {
  const entries: Array<[string, number]> = [];
  if (typeof subscores.contract === 'number' && !isNaN(subscores.contract)) {
    entries.push(['Contract', subscores.contract]);
  }
  if (
    typeof subscores.marketStructure === 'number' &&
    !isNaN(subscores.marketStructure)
  ) {
    entries.push(['Market', subscores.marketStructure]);
  }
  if (typeof subscores.behavior === 'number' && !isNaN(subscores.behavior)) {
    entries.push(['Behavior', subscores.behavior]);
  }
  // ADR-018: omit grid entirely if any subscore is missing
  if (entries.length !== 3) return null;

  const grid = document.createElement('div');
  setReset(grid);
  grid.style.padding = '12px 14px 8px';
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
  grid.style.gap = '10px';
  grid.style.borderBottom = `1px solid ${
    dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  }`;

  for (const [label, value] of entries) {
    const cell = document.createElement('div');
    setReset(cell);

    const labelEl = document.createElement('div');
    setReset(labelEl);
    labelEl.style.fontSize = '8.5px';
    labelEl.style.fontWeight = '700';
    labelEl.style.letterSpacing = '0.6px';
    labelEl.style.textTransform = 'uppercase';
    labelEl.style.color = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
    labelEl.textContent = label;
    cell.appendChild(labelEl);

    const cellTone = toneOf(value);
    const cellRing = toneColors(cellTone, dark).ring;

    const valueEl = document.createElement('div');
    setReset(valueEl);
    valueEl.style.fontFamily = BADGE_FONT_MONO;
    valueEl.style.fontSize = '13px';
    valueEl.style.fontWeight = '700';
    valueEl.style.color = cellRing;
    valueEl.style.marginTop = '2px';
    valueEl.textContent = String(value);
    cell.appendChild(valueEl);

    const barWrap = document.createElement('div');
    setReset(barWrap);
    barWrap.style.marginTop = '4px';
    barWrap.style.height = '3px';
    barWrap.style.borderRadius = '2px';
    barWrap.style.background = dark
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(0,0,0,0.06)';
    barWrap.style.overflow = 'hidden';

    const barFill = document.createElement('div');
    setReset(barFill);
    barFill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    barFill.style.height = '100%';
    barFill.style.background = cellRing;
    barWrap.appendChild(barFill);

    cell.appendChild(barWrap);
    grid.appendChild(cell);
  }

  return grid;
}

function buildCoverageLine(
  coverageRisk: string | null | undefined,
  dark: boolean,
): HTMLDivElement | null {
  if (coverageRisk !== 'high' && coverageRisk !== 'severe') return null;

  const line = document.createElement('div');
  setReset(line);
  line.style.padding = '8px 14px 0';
  line.style.fontSize = '11px';
  line.style.fontWeight = '700';
  line.style.color = dark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)';
  line.textContent =
    coverageRisk === 'severe'
      ? 'Data quality: Very limited'
      : 'Data quality: Limited';
  return line;
}

function buildBullets(
  reasons: string[],
  tone: BadgeTone,
  dark: boolean,
): HTMLDivElement | null {
  const trimmed = reasons.slice(0, 3);
  // ADR-018: omit block entirely when no reasons
  if (trimmed.length === 0) return null;

  const ringColor = toneColors(tone, dark).ring;

  const list = document.createElement('div');
  setReset(list);
  list.style.padding = '12px 14px 10px';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '8px';

  for (const reason of trimmed) {
    const row = document.createElement('div');
    setReset(row);
    row.style.display = 'flex';
    row.style.alignItems = 'flex-start';
    row.style.gap = '8px';

    const dot = document.createElement('span');
    setReset(dot);
    dot.style.flexShrink = '0';
    dot.style.marginTop = '5px';
    dot.style.width = '6px';
    dot.style.height = '6px';
    dot.style.borderRadius = '50%';
    dot.style.background = ringColor;
    row.appendChild(dot);

    const text = document.createElement('span');
    setReset(text);
    text.style.fontSize = '12px';
    text.style.lineHeight = '1.45';
    text.style.color = dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.78)';
    text.textContent = reason;
    row.appendChild(text);

    list.appendChild(row);
  }

  return list;
}

function buildFooter(
  tone: BadgeTone,
  dark: boolean,
  address: string,
): HTMLAnchorElement {
  const ringColor = toneColors(tone, dark).ring;

  const footer = document.createElement('a');
  footer.href = '#';
  footer.setAttribute('data-barryguard-footer', 'true');
  setReset(footer);
  footer.style.display = 'flex';
  footer.style.alignItems = 'center';
  footer.style.justifyContent = 'space-between';
  footer.style.padding = '10px 14px';
  footer.style.background = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  footer.style.color = ringColor;
  footer.style.fontFamily = BADGE_FONT_DISPLAY;
  footer.style.fontSize = '12px';
  footer.style.fontWeight = '700';
  footer.style.letterSpacing = '0.2px';
  footer.style.borderTop = `1px solid ${
    dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  }`;
  footer.style.cursor = 'pointer';

  const label = document.createElement('span');
  setReset(label);
  label.textContent = 'Open full analysis';
  footer.appendChild(label);

  const svgNS = 'http://www.w3.org/2000/svg';
  const arrow = document.createElementNS(svgNS, 'svg');
  arrow.setAttribute('width', '12');
  arrow.setAttribute('height', '12');
  arrow.setAttribute('viewBox', '0 0 12 12');
  arrow.setAttribute('fill', 'none');
  arrow.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', 'M3 9 L9 3 M9 3 H4 M9 3 V8');
  path.setAttribute('stroke', ringColor);
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  arrow.appendChild(path);
  footer.appendChild(arrow);

  footer.addEventListener('click', (event) => {
    event.preventDefault();
    sendOpenAnalysisMessage(address);
    if (panelEl) panelEl.style.display = 'none';
    cancelHide();
  });

  return footer;
}

function renderPanelContent(
  panel: HTMLDivElement,
  params: RenderFloatingPanelParams,
): void {
  const tone = toneOf(params.score);
  const dark = params.dark;

  // Container palette
  panel.style.background = dark ? '#15161a' : '#ffffff';
  panel.style.border = `1px solid ${
    dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
  }`;
  panel.style.color = dark ? '#ffffff' : '#0a0a0a';

  // Build fresh content (listeners re-attached per render)
  const fragments: Array<HTMLElement> = [];
  fragments.push(buildHeader(tone, params.score, dark));

  const grid = buildSubscoreGrid(params.subscores ?? {}, dark);
  if (grid) fragments.push(grid);

  const coverage = buildCoverageLine(params.coverageRisk, dark);
  if (coverage) fragments.push(coverage);

  const bullets = buildBullets(params.reasons, tone, dark);
  if (bullets) fragments.push(bullets);

  fragments.push(buildFooter(tone, dark, params.address));

  panel.replaceChildren(...fragments);
}

function positionPanel(panel: HTMLDivElement, badge: HTMLElement): void {
  const rect = badge.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Estimate panel height for overflow detection; actual height depends on content
  const estimatedHeight = panel.offsetHeight || 240;

  let top = rect.bottom + 6;
  if (top + estimatedHeight > vh) {
    top = Math.max(10, rect.top - estimatedHeight - 6);
  }

  let left = rect.left;
  if (left + PANEL_WIDTH > vw - 10) {
    left = Math.max(10, vw - PANEL_WIDTH - 10);
  }
  if (left < 10) left = 10;

  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

export function renderFloatingPanel(
  badge: HTMLDivElement,
  params: RenderFloatingPanelParams,
): void {
  // Persist params on the badge so hover handler can re-read them
  badge.dataset.bgScore = String(params.score);
  badge.dataset.bgReasons = JSON.stringify(params.reasons.slice(0, 3));
  if (params.subscores) {
    badge.dataset.bgSubscores = JSON.stringify(params.subscores);
  } else {
    delete badge.dataset.bgSubscores;
  }
  if (params.coverageRisk) {
    badge.dataset.bgCoverageRisk = params.coverageRisk;
  } else {
    delete badge.dataset.bgCoverageRisk;
  }
  badge.dataset.bgDark = params.dark ? '1' : '0';
  badge.dataset.bgAddress = params.address;

  // Guard against duplicate listeners on re-renders
  if (badge.dataset.bgPanelBound === 'true') return;
  badge.dataset.bgPanelBound = 'true';

  let showTimeout: ReturnType<typeof setTimeout> | null = null;

  badge.addEventListener('mouseenter', () => {
    cancelHide();
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }
    showTimeout = setTimeout(() => {
      const panel = ensurePanel();
      let subscoresParsed: FloatingPanelSubscores | undefined;
      if (badge.dataset.bgSubscores) {
        try {
          subscoresParsed = JSON.parse(badge.dataset.bgSubscores) as FloatingPanelSubscores;
        } catch {
          subscoresParsed = undefined;
        }
      }
      let reasonsParsed: string[] = [];
      try {
        reasonsParsed = JSON.parse(badge.dataset.bgReasons ?? '[]') as string[];
      } catch {
        reasonsParsed = [];
      }
      renderPanelContent(panel, {
        score: parseInt(badge.dataset.bgScore ?? '0', 10),
        reasons: reasonsParsed,
        subscores: subscoresParsed,
        coverageRisk: badge.dataset.bgCoverageRisk ?? null,
        dark: badge.dataset.bgDark === '1',
        address: badge.dataset.bgAddress ?? params.address,
      });
      panel.style.display = 'block';
      positionPanel(panel, badge);
      showTimeout = null;
    }, SHOW_DELAY_MS);
  });

  badge.addEventListener('mouseleave', () => {
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }
    scheduleHide();
  });
}
