import path from 'node:path';
import type { BundlerAdapter } from 'monosize';

import { runTerser } from './runTerser.mjs';
import { runWebpack, runWebpackMultiEntry } from './runWebpack.mjs';
import type { WebpackBundlerOptions } from './types.mjs';

const DEFAULT_CONFIG_ENHANCER: WebpackBundlerOptions = config => config;

/** Per-fixture output paths derived from the fixture path. */
function deriveFixturePaths(fixturePath: string): { outputDir: string; outputPath: string; debugOutputPath: string } {
  const outputDir = fixturePath.replace(/\.fixture\.js$/, '.output');
  return {
    outputDir,
    outputPath: path.join(outputDir, 'index.js'),
    debugOutputPath: fixturePath.replace(/\.fixture\.js$/, '.debug.js'),
  };
}

export function createWebpackBundler(configEnhancerCallback: WebpackBundlerOptions = DEFAULT_CONFIG_ENHANCER): BundlerAdapter {
  return {
    buildFixture: async function (options) {
      const { debug, fixturePath, quiet } = options;

      const { outputDir, outputPath, debugOutputPath } = deriveFixturePaths(fixturePath);

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
        outputDir,
        ...(debug && { debugOutputPath }),
      };
    },

    buildFixtures: async function (options) {
      const { debug, fixtures, quiet } = options;

      // Prepare output paths for all fixtures (one outputDir per fixture).
      const fixturesWithPaths = fixtures.map(({ fixturePath, name }) => ({
        fixturePath,
        name,
        ...deriveFixturePaths(fixturePath),
      }));

      // Build all fixtures in batch mode
      await runWebpackMultiEntry({
        enhanceConfig: configEnhancerCallback,
        fixtures: fixturesWithPaths,
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

      return fixturesWithPaths.map(({ name, outputDir, debugOutputPath }) => ({
        name,
        outputDir,
        ...(debug && { debugOutputPath }),
      }));
    },

    name: 'Webpack',
  };
}
