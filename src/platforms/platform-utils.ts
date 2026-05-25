import type { SelectedToken, TokenMetadata, TokenScore } from '../shared/types';
import {
  BADGE_FONT_DISPLAY,
  BADGE_FONT_MONO,
  toneColors,
  toneOf,
  verdictTextFromRisk,
  verdictTextStripe,
  type BadgeTone,
} from './badge-design-tokens';
import { ensureBadgeFontsLoaded } from './badge-font-injector';

function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';

  return message.toLowerCase().includes('extension context invalidated');
}

export function safeSendPopupMessage(payload: SelectedToken): void {
  if (!chrome?.runtime?.id) {
    return;
  }

  try {
    chrome.runtime.sendMessage({
      type: 'OPEN_POPUP_FOR_TOKEN',
      payload,
    }, () => {
      const runtimeError = chrome.runtime.lastError?.message;
      if (runtimeError && !isExtensionContextInvalidatedError(runtimeError)) {
        console.error('[BarryGuard] Badge action failed:', runtimeError);
      }
    });
  } catch (error) {
    if (!isExtensionContextInvalidatedError(error)) {
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Stripe-Badge (Design E aus Claude-Design-Handoff, 1:1)
// ---------------------------------------------------------------------------

export type StripeState =
  | 'scored'
  | 'loading'
  | 'error'
  | 'locked-quota'
  | 'locked-anonymous';

export interface RenderStripeParams {
  state: StripeState;
  score?: number;
  risk?: string;
  dark: boolean;
  compact?: boolean;
}

const STRIPE_WIDTH_NORMAL = 220;
const STRIPE_WIDTH_COMPACT = 160;

const LOCK_GLYPH = '\u{1F512}';

function applyResetToSpan(span: HTMLSpanElement): void {
  span.style.margin = '0';
  span.style.padding = '0';
  span.style.background = 'transparent';
  span.style.border = '0';
  span.style.boxShadow = 'none';
  span.style.textDecoration = 'none';
  span.style.boxSizing = 'border-box';
}

export function createBadgeElement(address: string): HTMLDivElement {
  ensureBadgeFontsLoaded().catch(() => {
    // best-effort; render proceeds with system-font fallback
  });

  const badge = document.createElement('div');
  badge.setAttribute('data-barryguard-badge', address);
  badge.setAttribute('data-barryguard', 'true');
  // Container styles — Design E geometry, defaults applied; tone-specific
  // bg/border/color are set later in renderStripeBadge().
  badge.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:8px',
    'padding:4px 8px 4px 4px',
    'border-radius:6px',
    'box-sizing:border-box',
    'vertical-align:middle',
    'text-decoration:none',
    'text-align:left',
    `font-family:${BADGE_FONT_DISPLAY}`,
    'line-height:1',
    'cursor:pointer',
    'z-index:1000',
    'white-space:nowrap',
    'margin-left:6px',
    'transition:all 0.2s ease',
  ].join(';');

  // Slot 1: Logo
  const logo = document.createElement('img');
  logo.setAttribute('data-slot', 'logo');
  logo.alt = '';
  logo.width = 22;
  logo.height = 22;
  logo.style.cssText = [
    'display:block',
    'width:22px',
    'height:22px',
    'flex-shrink:0',
    'box-sizing:border-box',
    'border:0',
  ].join(';');
  try {
    logo.src = chrome.runtime.getURL('badge/barryguard-logo.png');
  } catch {
    // chrome.runtime not available (test env) — leave src empty
  }
  badge.appendChild(logo);

  // Slot 2: Text-Stack (brand + verdict)
  const textStack = document.createElement('span');
  textStack.setAttribute('data-slot', 'text');
  applyResetToSpan(textStack);
  textStack.style.display = 'flex';
  textStack.style.flexDirection = 'column';
  textStack.style.gap = '2px';
  textStack.style.alignItems = 'flex-start';
  textStack.style.flex = '1';
  textStack.style.minWidth = '0';

  const brand = document.createElement('span');
  brand.setAttribute('data-slot', 'brand');
  applyResetToSpan(brand);
  brand.style.fontFamily = BADGE_FONT_DISPLAY;
  brand.style.fontSize = '7.5px';
  brand.style.fontWeight = '800';
  brand.style.letterSpacing = '-0.1px';
  brand.style.lineHeight = '1';
  brand.style.whiteSpace = 'nowrap';
  brand.style.opacity = '0.7';
  brand.textContent = 'BarryGuard';
  textStack.appendChild(brand);

  const verdict = document.createElement('span');
  verdict.setAttribute('data-slot', 'verdict');
  applyResetToSpan(verdict);
  verdict.style.fontFamily = BADGE_FONT_DISPLAY;
  verdict.style.fontSize = '10.5px';
  verdict.style.fontWeight = '700';
  verdict.style.letterSpacing = '0.4px';
  verdict.style.textTransform = 'uppercase';
  verdict.style.overflow = 'hidden';
  verdict.style.textOverflow = 'ellipsis';
  verdict.style.whiteSpace = 'nowrap';
  verdict.style.lineHeight = '1';
  textStack.appendChild(verdict);

  badge.appendChild(textStack);

  // Slot 3: Score
  const score = document.createElement('span');
  score.setAttribute('data-slot', 'score');
  applyResetToSpan(score);
  score.style.fontFamily = BADGE_FONT_MONO;
  score.style.fontWeight = '800';
  score.style.fontSize = '14px';
  score.style.letterSpacing = '-0.4px';
  score.style.flexShrink = '0';
  badge.appendChild(score);

  return badge;
}

interface StateDefinition {
  verdictText: string;
  scoreSlot: string;
  cursor: 'pointer' | 'default';
  paletteDark: boolean;
  // For non-scored states, fixed tone + manual opacity adjustment
  fixedTone?: 'safe' | 'caution' | 'neutral';
  opacity?: number;
}

/** Score-based fallback for `risk` when the backend field is absent. */
function scoreFallbackRisk(score: number): string {
  if (score >= 90) return 'low';
  if (score >= 75) return 'moderate';
  if (score >= 55) return 'caution';
  if (score >= 30) return 'high';
  return 'danger';
}

function resolveStateDefinition(
  params: RenderStripeParams,
): StateDefinition {
  switch (params.state) {
    case 'scored': {
      const tone = toneOf(params.score ?? 0);
      const verdictText = params.risk
        ? verdictTextFromRisk(params.risk)
        : verdictTextFromRisk(scoreFallbackRisk(params.score ?? 0));
      return {
        verdictText,
        scoreSlot: String(params.score ?? '?'),
        cursor: 'pointer',
        paletteDark: params.dark,
      };
    }
    case 'loading':
      return {
        verdictText: 'Analyzing',
        scoreSlot: '·',
        cursor: 'default',
        paletteDark: false,
        fixedTone: 'neutral',
        opacity: 0.5,
      };
    case 'error':
      return {
        verdictText: 'Unavailable',
        scoreSlot: '?',
        cursor: 'default',
        paletteDark: false,
        fixedTone: 'caution',
      };
    case 'locked-quota':
      return {
        verdictText: 'Limit reached',
        scoreSlot: LOCK_GLYPH,
        cursor: 'default',
        paletteDark: false,
        fixedTone: 'caution',
      };
    case 'locked-anonymous':
      return {
        verdictText: 'Sign up free to see all checks',
        scoreSlot: LOCK_GLYPH,
        cursor: 'pointer',
        paletteDark: false,
        fixedTone: 'caution',
      };
  }
}

export function renderStripeBadge(
  badge: HTMLDivElement,
  params: RenderStripeParams,
): void {
  const def = resolveStateDefinition(params);

  // Resolve palette
  let tone: BadgeTone;
  if (def.fixedTone) {
    tone = def.fixedTone;
  } else {
    tone = toneOf(params.score ?? 0);
  }
  const colors = toneColors(tone, def.paletteDark);

  // Container style: width, palette, cursor, opacity
  const width = params.compact ? STRIPE_WIDTH_COMPACT : STRIPE_WIDTH_NORMAL;
  badge.style.width = `${width}px`;
  badge.style.background = colors.bg;
  badge.style.color = colors.fg;
  badge.style.border = `1px solid ${colors.ring}`;
  badge.style.boxShadow = 'none';
  badge.style.cursor = def.cursor;
  badge.style.opacity = def.opacity !== undefined ? String(def.opacity) : '1';

  // Slots
  const verdictNode = badge.querySelector<HTMLSpanElement>('[data-slot="verdict"]');
  if (verdictNode) {
    verdictNode.textContent = def.verdictText;
    verdictNode.style.color = colors.fg;
  }
  const brandNode = badge.querySelector<HTMLSpanElement>('[data-slot="brand"]');
  if (brandNode) {
    brandNode.style.color = colors.fg;
  }
  const scoreNode = badge.querySelector<HTMLSpanElement>('[data-slot="score"]');
  if (scoreNode) {
    scoreNode.textContent = def.scoreSlot;
    scoreNode.style.color = colors.fg;
  }

  // ADR-020: locked-anonymous opens sign-up flow on click.
  if (params.state === 'locked-anonymous') {
    const address = badge.getAttribute('data-barryguard-badge') ?? '';
    badge.onclick = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      safeSendPopupMessage({ address });
    };
  }
}

// ---------------------------------------------------------------------------
// Hover-Detail: delegiert an Floating Detail Panel (Design F, 1:1).
// ---------------------------------------------------------------------------
//
// renderBadgeTooltip bleibt als Backward-Compat-Alias erhalten und delegiert
// an renderFloatingPanel aus ./floating-panel.ts. Call-sites koennen auch
// direkt renderFloatingPanel(badge, { ... }) verwenden — bevorzugt fuer
// neue Pfade, weil dann subscores mitgegeben werden koennen.
//
// setBadgeContent und getRiskColors wurden in 1.7.19 entfernt — ersetzt
// durch renderStripeBadge oben (Design E stripe badge).

export {
  renderFloatingPanel,
  type RenderFloatingPanelParams,
  type FloatingPanelSubscores,
} from './floating-panel';
