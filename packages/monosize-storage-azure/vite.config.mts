/// <reference types='vitest' />
import { defineConfig } from 'vite';

import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/monosize-storage-azure',
  plugins: [nxViteTsPaths()],

  test: {
    cache: {
      dir: '../../node_modules/.vitest',
    },
    include: ['src/**/*.test.mts'],
  },
});
