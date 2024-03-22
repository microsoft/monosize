import type { BundlerAdapter } from 'monosize';

import { runEsbuild } from './runEsbuild.mjs';
import type { EsbuildBundlerOptions } from './types.mjs';

const DEFAULT_CONFIG_ENHANCER: EsbuildBundlerOptions = config => config;

export function createEsbuildBundler(configEnhancerCallback = DEFAULT_CONFIG_ENHANCER): BundlerAdapter {
  return {
    buildFixture: async function (options) {
      const { fixturePath, quiet } = options;
      const outputPath = fixturePath.replace(/\.fixture.js$/, '.output.js');

      await runEsbuild({
        enhanceConfig: configEnhancerCallback,
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
