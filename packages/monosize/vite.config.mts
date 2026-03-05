/// <reference types='vitest' />
import { defineConfig } from 'vite';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/monosize',

  resolve: {
    conditions: ['@monosize/source'],
  },

  test: {
    reporters: ['default'],
    include: ['src/**/*.test.mts'],
  },
});
