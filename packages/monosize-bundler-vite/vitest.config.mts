import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/monosize-bundler-vite',

  resolve: {
    conditions: ['@monosize/source'],
  },

  test: {
    reporters: ['default'],
    include: ['src/**/*.test.mts'],
  },
});
