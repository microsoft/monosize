import path from 'node:path';
import TerserWebpackPlugin from 'terser-webpack-plugin';
import webpack from 'webpack';
import type { Configuration as WebpackConfiguration } from 'webpack';

import { WebpackBundlerOptions } from './types.mjs';

/**
 * Creates the base Webpack configuration shared by both sequential and batch builds.
 */
function createBaseWebpackConfig(debug: boolean): Partial<WebpackConfiguration> {
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

    performance: {
      hints: false,
    },
    optimization: {
      minimizer: [
        new TerserWebpackPlugin({
          extractComments: false,
          terserOptions: {
            format: {
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

function createWebpackConfig(fixturePath: string, outputPath: string, debug: boolean): WebpackConfiguration {
  return {
    ...createBaseWebpackConfig(debug),

    entry: fixturePath,
    output: {
      filename: path.basename(outputPath),
      path: path.dirname(outputPath),

      ...(debug && {
        pathinfo: true,
      }),
    },
  } as WebpackConfiguration;
}

function createMultiEntryWebpackConfig(
  fixtures: Array<{ fixturePath: string; outputPath: string }>,
  debug: boolean,
): WebpackConfiguration {
  // Build entry object with keys derived from output filenames
  const entry = fixtures.reduce<Record<string, string>>(
    (acc, { fixturePath, outputPath }) => {
      const entryName = path.basename(outputPath, path.extname(outputPath));
      acc[entryName] = fixturePath;
      return acc;
    },
    {},
  );

  // All fixtures should output to the same directory
  const outputDir = path.dirname(fixtures[0].outputPath);

  return {
    ...createBaseWebpackConfig(debug),

    entry,
    output: {
      filename: '[name].js',
      path: outputDir,

      ...(debug && {
        pathinfo: true,
      }),
    },
  } as WebpackConfiguration;
}

/**
 * Shared function to compile a webpack configuration.
 */
async function compileWebpackConfig(config: WebpackConfiguration): Promise<null> {
  return new Promise((resolve, reject) => {
    const compiler = webpack(config);

    compiler.run((err, result) => {
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

type RunWebpackOptions = {
  enhanceConfig: WebpackBundlerOptions;

  fixturePath: string;
  outputPath: string;

  debug: boolean;
  quiet: boolean;
};

export async function runWebpack(options: RunWebpackOptions): Promise<null> {
  const { enhanceConfig, fixturePath, outputPath, debug } = options;
  const webpackConfig = enhanceConfig(createWebpackConfig(fixturePath, outputPath, debug));
  return compileWebpackConfig(webpackConfig);
}

type RunWebpackMultiEntryOptions = {
  enhanceConfig: WebpackBundlerOptions;

  fixtures: Array<{ fixturePath: string; outputPath: string }>;

  debug: boolean;
  quiet: boolean;
};

export async function runWebpackMultiEntry(options: RunWebpackMultiEntryOptions): Promise<null> {
  const { enhanceConfig, fixtures, debug } = options;
  const webpackConfig = enhanceConfig(createMultiEntryWebpackConfig(fixtures, debug));
  return compileWebpackConfig(webpackConfig);
}
