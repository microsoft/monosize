import type { BundlerAdapter } from 'monosize';

import { runEsbuild, runEsbuildMultiEntry } from './runEsbuild.mjs';
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

    buildFixtures: async function (options) {
      const { fixtures, quiet } = options;

      const fixturesWithPaths = fixtures.map(({ fixturePath, name }) => ({
        fixturePath,
        name,
        outputPath: fixturePath.replace(/\.fixture.js$/, '.output.js'),
      }));

      await runEsbuildMultiEntry({
        enhanceConfig: configEnhancerCallback,
        fixtures: fixturesWithPaths,
        quiet,
      });

      return fixturesWithPaths.map(({ name, outputPath }) => ({
        name,
        outputPath,
      }));
    },

    name: 'esbuild',
  };
}
