import { defineContentScript } from 'wxt/utils/define-content-script';
import { initializeContentScript } from '../content';

export default defineContentScript({
  matches: ['*://pump.fun/*'],
  runAt: 'document_end',
  main() {
    initializeContentScript();
  },
});
