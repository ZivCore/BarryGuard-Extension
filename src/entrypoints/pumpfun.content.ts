import { defineContentScript } from 'wxt/utils/define-content-script';
import { initializeContentScript } from '../content';

function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';

  return message.toLowerCase().includes('extension context invalidated');
}

export default defineContentScript({
  matches: ['*://pump.fun/*'],
  runAt: 'document_end',
  main() {
    try {
      initializeContentScript();
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        return;
      }

      throw error;
    }
  },
});
