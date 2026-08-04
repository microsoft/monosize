import { defineConfig, type ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = defineConfig({
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

export default config;
