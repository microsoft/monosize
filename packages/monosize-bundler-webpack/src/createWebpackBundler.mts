import type { BundlerAdapter } from 'monosize';

import { runTerser } from './runTerser.mjs';
import { runWebpack, runWebpackMultiEntry } from './runWebpack.mjs';
import type { WebpackBundlerOptions } from './types.mjs';

const DEFAULT_CONFIG_ENHANCER: WebpackBundlerOptions = config => config;

export function createWebpackBundler(configEnhancerCallback = DEFAULT_CONFIG_ENHANCER): BundlerAdapter {
  return {
    buildFixture: async function (options) {
      const { debug, fixturePath, quiet } = options;

      const outputPath = fixturePath.replace(/\.fixture.js$/, '.output.js');
      const debugOutputPath = fixturePath.replace(/\.fixture.js$/, '.debug.js');

      await runWebpack({
        enhanceConfig: configEnhancerCallback,
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

    buildFixtures: async function (options) {
      const { debug, fixtures, quiet } = options;

      // Prepare output paths for all fixtures
      const fixturesWithPaths = fixtures.map(({ fixturePath, name }) => ({
        fixturePath,
        name,
        outputPath: fixturePath.replace(/\.fixture.js$/, '.output.js'),
        debugOutputPath: fixturePath.replace(/\.fixture.js$/, '.debug.js'),
      }));

      // Build all fixtures in a single webpack run
      await runWebpackMultiEntry({
        enhanceConfig: configEnhancerCallback,
        fixtures: fixturesWithPaths.map(f => ({ fixturePath: f.fixturePath, outputPath: f.outputPath })),
        debug,
        quiet,
      });

      // Run terser on all outputs if in debug mode
      if (debug) {
        await Promise.all(
          fixturesWithPaths.map(async ({ fixturePath, outputPath, debugOutputPath }) => {
            await runTerser({
              fixturePath,
              sourcePath: outputPath,
              outputPath,
              debugOutputPath,
              quiet,
            });
          }),
        );
      }

      return fixturesWithPaths.map(({ name, outputPath, debugOutputPath }) => ({
        name,
        outputPath,
        ...(debug && {
          debugOutputPath,
        }),
      }));
    },

    name: 'Webpack',
  };
}
