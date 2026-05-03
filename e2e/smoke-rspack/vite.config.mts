/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/smoke-rspack',

  resolve: {
    conditions: ['@monosize/source'],
  },

  test: {
    reporters: ['default'],
    include: ['**/*.test.mts'],
    // Real bundler builds + subprocess invocations are slow.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
