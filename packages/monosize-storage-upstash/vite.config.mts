/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/monosize-storage-upstash',
  plugins: [nxViteTsPaths()],

  test: {
    reporters: ['default'],
    include: ['src/**/*.test.mts'],
  },
});
