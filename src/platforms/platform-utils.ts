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
    high: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
    medium: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
    low: { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0' },
  };

  return map[risk] ?? map.high;
}

export function mergeTokenMetadata(primary?: TokenMetadata, secondary?: TokenMetadata): TokenMetadata {
  return {
    ...(primary ?? {}),
    ...(secondary ?? {}),
  };
}
