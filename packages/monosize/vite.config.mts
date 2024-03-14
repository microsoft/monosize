/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/monosize',
  plugins: [nxViteTsPaths()],

  test: {
    reporters: ['default'],
    cache: {
      dir: '../../node_modules/.vitest',
    },
    include: ['src/**/*.test.mts'],
  },
});
