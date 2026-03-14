import { defineBackground } from 'wxt/utils/define-background';
import { initializeBackground } from '../background';

export default defineBackground({
  type: 'module',
  main() {
    initializeBackground();
  },
});
