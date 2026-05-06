import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'src/**/__tests__/*.test.ts'],
    exclude: ['tests/e2e/**/*.test.ts'],
  },
});
