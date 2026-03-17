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
    'box-shadow:0 4px 10px rgba(15,23,42,0.08)',
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
let _tooltipShowTimeout: ReturnType<typeof setTimeout> | null = null;

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
  }
  return _tooltipElement;
}

export function renderBadgeTooltip(
  badge: HTMLDivElement,
  score: number,
  risk: string,
  reasons: string[],
): void {
  setBadgeTooltipData(badge, score, risk, reasons);

  const tooltip = getTooltipElement();
  let hideTimeoutId: ReturnType<typeof setTimeout> | null = null;
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

    let html = `<div style="font-weight:600;font-size:12.5px;margin-bottom:8px;">${riskIcon} Risk: ${riskLabel}${scoreValue ? ` (${scoreValue})` : ''}</div>`;
    html += `<div style="height:1px;background:#334155;margin:6px 0"></div>`;

    if (reasonsData.length > 0) {
      reasonsData.slice(0, 3).forEach((reason) => {
        const trimmed = reason.substring(0, 55);
        html += `<div style="padding-left:8px;margin-bottom:4px;">• ${trimmed}${reason.length > 55 ? '…' : ''}</div>`;
      });
    } else {
      html += '<div style="color:#94a3b8;font-style:italic;">No major concerns detected</div>';
    }

    html += `<div style="height:10px"></div>`;
    html += `<div style="font-size:11px;color:#60a5fa;text-align:center;cursor:pointer;">Full analysis ↗</div>`;

    tooltip.innerHTML = html;

    const badgeRect = badge.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = badgeRect.left;
    let top = badgeRect.bottom + 8;

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
    if (hideTimeoutId) {
      clearTimeout(hideTimeoutId);
      hideTimeoutId = null;
    }
  }

  badge.addEventListener('mouseenter', (event) => {
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
    hideTooltip();
  });
}

export function setBadgeContent(badge: HTMLDivElement, value: string, compact = false): void {
  const label = compact ? 'BG' : 'BarryGuard';
  const labelStyle = compact
    ? 'font-size:9px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;line-height:1;'
    : 'font-size:10px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;line-height:1;';
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

export function getRiskColors(risk: string): { bg: string; text: string; border: string } {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    critical: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
    high: { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' },
    moderate: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
    low: { bg: '#ccfbf1', text: '#115e59', border: '#99f6e4' },
    safe: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
    // Backward compatibility
    medium: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  };

  return map[risk] ?? map.critical;
}

export function mergeTokenMetadata(primary?: TokenMetadata, secondary?: TokenMetadata): TokenMetadata {
  return {
    ...(primary ?? {}),
    ...(secondary ?? {}),
  };
}
