import type { BundlerAdapter } from 'monosize';

import { runEsbuild } from './runEsbuild.mjs';
import type { EsbuildBundlerOptions } from './types.mjs';

const DEFAULT_CONFIG_ENHANCER: NonNullable<EsbuildBundlerOptions['enhanceConfig']> = config => config;

export function createEsbuildBundler(options: EsbuildBundlerOptions = {}): BundlerAdapter {
  const { enhanceConfig = DEFAULT_CONFIG_ENHANCER } = options;

  return {
    buildFixture: async function (options) {
      const { fixturePath, quiet } = options;
      const outputPath = fixturePath.replace(/\.fixture.js$/, '.output.js');

      await runEsbuild({
        enhanceConfig,
        fixturePath,
        outputPath,
        quiet,
      });

      return {
        outputPath,
      };
    },
  };
}
