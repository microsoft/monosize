import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/monosize-storage-git',

  resolve: {
    conditions: ['@monosize/source'],
  },

  test: {
    reporters: ['default'],
    include: ['src/**/*.test.mts'],
  },
});
