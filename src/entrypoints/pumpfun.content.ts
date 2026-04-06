import { defineContentScript } from 'wxt/utils/define-content-script';
import { initializeContentScript } from '../content';
import { PLATFORM_HOST_PATTERNS } from '../manifest/platform-hosts';

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
  matches: [...PLATFORM_HOST_PATTERNS],
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
