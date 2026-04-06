import type { SelectedToken, TokenMetadata, TokenScore } from '../shared/types';

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

export function createBadgeElement(address: string): HTMLDivElement {
  const badge = document.createElement('div');
  badge.setAttribute('data-barryguard-badge', address);
  badge.setAttribute('data-barryguard', 'true');
  badge.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'gap:6px',
    'padding:4px 8px',
    'border-radius:999px',
    'font-size:11px',
    'font-weight:700',
    'font-family:system-ui,-apple-system,sans-serif',
    'margin-left:6px',
    'cursor:pointer',
    'transition:all 0.2s ease',
    'z-index:1000',
    'white-space:nowrap',
    'box-shadow:0 0 8px rgba(220,38,38,0.5)',
  ].join(';');

  return badge;
}

export function setBadgeTooltipData(
  badge: HTMLDivElement,
  score: number,
  risk: string,
  reasons: string[],
): void {
  badge.dataset.bgScore = String(score);
  badge.dataset.bgRisk = risk;
  badge.dataset.bgReasons = JSON.stringify(reasons.slice(0, 3));
}

let _tooltipElement: HTMLDivElement | null = null;
let _tooltipHideTimeout: ReturnType<typeof setTimeout> | null = null;

function _scheduleTooltipHide(): void {
  if (_tooltipHideTimeout) {
    clearTimeout(_tooltipHideTimeout);
  }
  _tooltipHideTimeout = setTimeout(() => {
    if (_tooltipElement) {
      _tooltipElement.style.display = 'none';
    }
    _tooltipHideTimeout = null;
  }, 200);
}

function _cancelTooltipHide(): void {
  if (_tooltipHideTimeout) {
    clearTimeout(_tooltipHideTimeout);
    _tooltipHideTimeout = null;
  }
}

function getTooltipElement(): HTMLDivElement {
  if (!_tooltipElement) {
    _tooltipElement = document.createElement('div');
    _tooltipElement.setAttribute('data-barryguard-tooltip', 'true');
    _tooltipElement.style.cssText = [
      'position:fixed',
      'display:none',
      'background:#1e293b',
      'color:#f8fafc',
      'padding:12px 14px',
      'border-radius:10px',
      'font-size:12px',
      'line-height:1.5',
      'font-family:system-ui,-apple-system,sans-serif',
      'box-shadow:0 8px 30px rgba(0,0,0,0.25)',
      'z-index:999999',
      'max-width:280px',
      'min-width:220px',
    ].join(';');
    document.body.appendChild(_tooltipElement);

    // Attach tooltip hover listeners once at creation time.
    // When the user moves from the badge into the tooltip, cancel the
    // pending hide so they can interact with content (e.g. "Full analysis" link).
    _tooltipElement.addEventListener('mouseenter', () => {
      _cancelTooltipHide();
    });
    _tooltipElement.addEventListener('mouseleave', () => {
      _scheduleTooltipHide();
    });
  }
  return _tooltipElement;
}

export function renderBadgeTooltip(
  badge: HTMLDivElement,
  score: number,
  risk: string,
  reasons: string[],
  coverageRisk?: string | null,
): void {
  setBadgeTooltipData(badge, score, risk, reasons);

  const tooltip = getTooltipElement();
  let showTimeoutId: ReturnType<typeof setTimeout> | null = null;

  function getRiskIcon(riskLevel: string): string {
    const level = riskLevel.toLowerCase();
    if (level === 'critical') return '🚨';
    if (level === 'high') return '⚠️';
    if (level === 'moderate' || level === 'medium') return '⚡';
    if (level === 'low') return '🟢';
    return '✅';
  }

  function formatRiskLabel(riskLevel: string): string {
    const labels: Record<string, string> = {
      critical: 'CRITICAL',
      high: 'HIGH',
      moderate: 'MODERATE',
      low: 'LOW',
      safe: 'VERY LOW',
      medium: 'MODERATE',
    };
    return labels[riskLevel.toLowerCase()] ?? riskLevel.toUpperCase();
  }

  function showTooltip(event: MouseEvent): void {
    const scoreValue = parseInt(badge.dataset.bgScore ?? '', 10);
    const riskValue = badge.dataset.bgRisk ?? 'high';
    let reasonsData: string[] = [];
    try {
      reasonsData = JSON.parse(badge.dataset.bgReasons ?? '[]') as string[];
    } catch {
      reasonsData = reasons.slice(0, 3);
    }

    const riskIcon = getRiskIcon(riskValue);
    const riskLabel = formatRiskLabel(riskValue);

    // Safe DOM construction — no innerHTML with API-sourced data (XSS prevention)
    tooltip.textContent = '';

    const header = document.createElement('div');
    Object.assign(header.style, { fontWeight: '600', fontSize: '12.5px', marginBottom: '8px' });
    header.textContent = `${riskIcon} Risk: ${riskLabel}${scoreValue ? ` (${scoreValue})` : ''}`;
    tooltip.appendChild(header);

    if (coverageRisk === 'high' || coverageRisk === 'severe') {
      const dqEl = document.createElement('div');
      Object.assign(dqEl.style, { fontSize: '10px', color: '#f59e0b', marginBottom: '6px' });
      dqEl.textContent = `Data quality: ${coverageRisk === 'severe' ? 'Very limited' : 'Limited'}`;
      tooltip.appendChild(dqEl);
    }

    const divider = document.createElement('div');
    Object.assign(divider.style, { height: '1px', background: '#334155', margin: '6px 0' });
    tooltip.appendChild(divider);

    if (reasonsData.length > 0) {
      reasonsData.slice(0, 3).forEach((reason) => {
        const row = document.createElement('div');
        Object.assign(row.style, { paddingLeft: '8px', marginBottom: '4px' });
        row.textContent = `• ${reason.substring(0, 55)}${reason.length > 55 ? '…' : ''}`;
        tooltip.appendChild(row);
      });
    } else {
      const noIssues = document.createElement('div');
      Object.assign(noIssues.style, { color: '#94a3b8', fontStyle: 'italic' });
      noIssues.textContent = 'No major concerns detected';
      tooltip.appendChild(noIssues);
    }

    const spacer = document.createElement('div');
    spacer.style.height = '10px';
    tooltip.appendChild(spacer);

    const cta = document.createElement('div');
    Object.assign(cta.style, { fontSize: '11px', color: '#60a5fa', textAlign: 'center', cursor: 'pointer' });
    cta.textContent = 'Full analysis ↗';
    tooltip.appendChild(cta);

    const badgeRect = badge.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = badgeRect.left;
    let top = badgeRect.bottom + 4;

    if (top + 140 > viewportHeight) {
      top = badgeRect.top - 140;
    }

    if (left + 240 > viewportWidth) {
      left = viewportWidth - 250;
    }
    if (left < 10) {
      left = 10;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.display = 'block';

    const fullAnalysisLink = tooltip.querySelector('div:last-child');
    if (fullAnalysisLink) {
      fullAnalysisLink.addEventListener('click', () => {
        const address = badge.dataset.barryguardBadge;
        if (address) {
          safeSendPopupMessage({ address });
        }
        hideTooltip();
      });
    }
  }

  function hideTooltip(): void {
    tooltip.style.display = 'none';
    _cancelTooltipHide();
  }

  // Guard against duplicate listeners on re-renders
  if (badge.dataset.bgTooltipBound) return;
  badge.dataset.bgTooltipBound = 'true';

  badge.addEventListener('mouseenter', (event) => {
    _cancelTooltipHide();
    if (showTimeoutId) {
      clearTimeout(showTimeoutId);
      showTimeoutId = null;
    }
    showTimeoutId = setTimeout(() => {
      showTooltip(event);
      showTimeoutId = null;
    }, 150);
  });

  badge.addEventListener('mouseleave', () => {
    if (showTimeoutId) {
      clearTimeout(showTimeoutId);
      showTimeoutId = null;
    }
    _scheduleTooltipHide();
  });
}

export function setBadgeContent(badge: HTMLDivElement, value: string, compact = false): void {
  // Label is always "BarryGuard".
  const label = 'BarryGuard';
  const labelStyle = compact
    ? 'font-size:9px;font-weight:800;letter-spacing:0.02em;line-height:1;'
    : 'font-size:10px;font-weight:800;letter-spacing:0.03em;line-height:1;';
  const valueStyle = compact
    ? 'font-size:11px;font-weight:800;line-height:1;'
    : 'font-size:12px;font-weight:800;line-height:1;';

  const labelNode = document.createElement('span');
  labelNode.style.cssText = labelStyle;
  labelNode.textContent = label;

  const valueNode = document.createElement('span');
  valueNode.style.cssText = valueStyle;
  valueNode.textContent = value;

  badge.replaceChildren(labelNode, valueNode);
}

export function getRiskColors(risk: string): { bg: string; text: string; border: string; glow: string } {
  const map: Record<string, { bg: string; text: string; border: string; glow: string }> = {
    danger:   { bg: '#dc2626', text: '#ffffff', border: '#b91c1c', glow: '0 0 8px rgba(220,38,38,0.5)' },
    high:     { bg: '#ea580c', text: '#ffffff', border: '#c2410c', glow: '0 0 8px rgba(234,88,12,0.5)' },
    caution:  { bg: '#d97706', text: '#ffffff', border: '#b45309', glow: '0 0 8px rgba(217,119,6,0.4)' },
    moderate: { bg: '#16a34a', text: '#ffffff', border: '#15803d', glow: '0 0 8px rgba(22,163,74,0.4)' },
    low:      { bg: '#059669', text: '#ffffff', border: '#047857', glow: '0 0 8px rgba(5,150,105,0.4)' },
    // Backward compatibility
    critical: { bg: '#dc2626', text: '#ffffff', border: '#b91c1c', glow: '0 0 8px rgba(220,38,38,0.5)' },
    medium:   { bg: '#d97706', text: '#ffffff', border: '#b45309', glow: '0 0 8px rgba(217,119,6,0.4)' },
    safe:     { bg: '#059669', text: '#ffffff', border: '#047857', glow: '0 0 8px rgba(5,150,105,0.4)' },
  };

  return map[risk] ?? map.danger;
}

export function mergeTokenMetadata(primary?: TokenMetadata, secondary?: TokenMetadata): TokenMetadata {
  return {
    ...(primary ?? {}),
    ...(secondary ?? {}),
  };
}
