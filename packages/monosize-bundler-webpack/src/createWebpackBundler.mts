import type { BundlerAdapter } from 'monosize';

import { runTerser } from './runTerser.mjs';
import { runWebpack } from './runWebpack.mjs';
import type { WebpackBundlerOptions } from './types.mjs';

const DEFAULT_CONFIG_ENHANCER: NonNullable<WebpackBundlerOptions['enhanceConfig']> = config => config;

export function createWebpackBundler(options: WebpackBundlerOptions = {}): BundlerAdapter {
  const { enhanceConfig = DEFAULT_CONFIG_ENHANCER } = options;

  return {
    buildFixture: async function (options) {
      const { debug, fixturePath, quiet } = options;

      const outputPath = fixturePath.replace(/\.fixture.js$/, '.output.js');
      const debugOutputPath = fixturePath.replace(/\.fixture.js$/, '.debug.js');

      await runWebpack({
        enhanceConfig,
        fixturePath,
        outputPath,
        debug,
        quiet,
      });

      if (debug) {
        await runTerser({
          fixturePath,
          sourcePath: outputPath,
          outputPath,
          debugOutputPath,
          quiet,
        });
      }

      return {
        outputPath,
        ...(debug && {
          debugOutputPath,
        }),
      };
    },
  };
}
