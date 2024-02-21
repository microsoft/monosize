import pc from 'picocolors';
import { gzipSizeFromFile } from 'gzip-size';
import fs from 'node:fs';
import path from 'node:path';
import { minify } from 'terser';
import TerserWebpackPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import type { Configuration as WebpackConfiguration } from 'webpack';

import { hrToSeconds } from './helpers.mjs';
import { PreparedFixture } from './prepareFixture.mjs';
import type { BuildResult, MonoSizeConfig } from '../types.mjs';

function createWebpackConfig(fixturePath: string, outputPath: string, debug: boolean): WebpackConfiguration {
  return {
    name: 'client',
    target: 'web',
    mode: 'production',

    cache: {
      type: 'memory',
    },
    externals: {
      react: 'React',
      'react-dom': 'ReactDOM',
    },

    entry: fixturePath,
    output: {
      filename: path.basename(outputPath),
      path: path.dirname(outputPath),

      ...(debug && {
        pathinfo: true,
      }),
    },
    performance: {
      hints: false,
    },
    optimization: {
      minimizer: [
        new TerserWebpackPlugin({
          extractComments: false,
          terserOptions: {
            output: {
              comments: false,
            },
          },
        }),
      ],

      // If debug mode is enabled, we want to disable minification and rely on Terser to produce a partially minified
      // file for debugging purposes
      ...(debug && {
        minimize: false,
        minimizer: [],
      }),
    },

    ...(debug && {
      stats: {
        optimizationBailout: true,
      },
    }),
  };
}

type RunWebpackOptions = {
  config: MonoSizeConfig;
  fixture: PreparedFixture;

  outputPath: string;
  debug: boolean;
  quiet: boolean;
};

async function runWebpack(options: RunWebpackOptions): Promise<null> {
  const { config, fixture, outputPath, debug, quiet } = options;
  const webpackStartTime = process.hrtime();

  const webpackConfig = createWebpackConfig(fixture.absolutePath, outputPath, debug);
  const finalWebpackConfig = config.webpack ? config.webpack(webpackConfig) : webpackConfig;

  return new Promise((resolve, reject) => {
    const compiler = webpack(finalWebpackConfig);

    compiler.run((err, result) => {
      if (!quiet) {
        console.log(
          [
            pc.blue('[i]'),
            `"${path.basename(fixture.relativePath)}": Webpack in ${hrToSeconds(process.hrtime(webpackStartTime))}`,
          ].join(' '),
        );
      }

      if (err) {
        reject(err);
      }
      if (result && result.hasErrors()) {
        reject(result.compilation.errors.join('\n'));
      }

      resolve(null);
    });
  });
}

type RunTerserOptions = {
  fixture: PreparedFixture;

  sourcePath: string;
  outputPath: string;
  debugOutputPath: string;

  quiet: boolean;
};

async function runTerser(options: RunTerserOptions) {
  const { fixture, debugOutputPath, sourcePath, outputPath, quiet } = options;

  const startTime = process.hrtime();
  const sourceContent = await fs.promises.readFile(sourcePath, 'utf8');

  // Performs only dead-code elimination
  /* eslint-disable @typescript-eslint/naming-convention */
  const debugOutput = await minify(sourceContent, {
    mangle: false,
    output: {
      beautify: true,
      comments: true,
      preserve_annotations: true,
    },
  });
  // Performs full minification
  const minifiedOutput = await minify(sourceContent, {
    output: {
      comments: false,
    },
  });
  /* eslint-enable @typescript-eslint/naming-convention */

  if (!debugOutput.code || !minifiedOutput.code) {
    throw new Error('Got an empty output from Terser, this is not expected...');
  }

  await fs.promises.writeFile(debugOutputPath, debugOutput.code);
  await fs.promises.writeFile(outputPath, minifiedOutput.code);

  if (!quiet) {
    console.log(
      [
        pc.blue('[i]'),
        `"${path.basename(fixture.relativePath)}": Terser in ${hrToSeconds(process.hrtime(startTime))}`,
      ].join(' '),
    );
  }
}

// ---

type BuildFixtureOptions = {
  config: MonoSizeConfig;
  preparedFixture: PreparedFixture;
  debug: boolean;
  quiet: boolean;
};

/**
 * Builds a fixture with Webpack and then minifies it with Terser. Produces two files as artifacts:
 * - partially minified file (.output.js) for debugging
 * - fully minified file (.min.js)
 */
export async function buildFixture(options: BuildFixtureOptions): Promise<
  BuildResult & {
    outputPath: string;
    debugOutputPath?: string;
  }
> {
  const { config, debug, preparedFixture, quiet } = options;

  const outputPath = preparedFixture.absolutePath.replace(/\.fixture.js$/, '.output.js');
  const debugOutputPath = preparedFixture.absolutePath.replace(/\.fixture.js$/, '.debug.js');

  await runWebpack({
    config,
    fixture: preparedFixture,
    outputPath,
    debug,
    quiet,
  });

  if (debug) {
    await runTerser({
      fixture: preparedFixture,
      sourcePath: outputPath,
      outputPath,
      debugOutputPath,
      quiet,
    });
  }

  const minifiedSize = (await fs.promises.stat(outputPath)).size;
  const gzippedSize = await gzipSizeFromFile(outputPath);

  return {
    name: preparedFixture.name,
    path: preparedFixture.relativePath,

    minifiedSize,
    gzippedSize,

    outputPath,
    ...(debug && {
      debugOutputPath,
    }),
  };
}
