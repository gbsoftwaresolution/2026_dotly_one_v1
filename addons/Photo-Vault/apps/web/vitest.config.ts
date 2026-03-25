import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/vitest.setup.ts'],
    globals: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
