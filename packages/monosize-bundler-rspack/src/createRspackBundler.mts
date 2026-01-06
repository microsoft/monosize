import path from 'node:path';
import { createRsbuild, type EnvironmentConfig, type RsbuildConfig, logger } from '@rsbuild/core';
import type { BundlerAdapter, BundlerAdapterFactoryConfig } from 'monosize';

const DEFAULT_CONFIG_ENHANCER: BundlerAdapterFactoryConfig<RsbuildConfig> = config => config;

function createBaseEnvironmentConfig(params: {
  entry: Record<string, string>;
  outputDir: string;
  filename: string;
  minify: boolean;
}): EnvironmentConfig {
  const { entry, outputDir, filename, minify } = params;

  return {
    source: {
      entry,
    },

    output: {
      externals: {
        react: 'React',
        'react-dom': 'ReactDOM',
      },
      target: 'web',

      emitAssets: false,

      filename: {
        js: filename,
      },
      distPath: {
        root: outputDir,
        js: './',
      },

      minify,
    },

    performance: {
      chunkSplit: {
        strategy: 'all-in-one',
      },
    },
  };
}

export function createEnvironmentConfig(params: {
  fixturePath: string;
  outputPath: string;
  debugOutputPath?: string;
}): Record<string, EnvironmentConfig> {
  const { fixturePath, outputPath, debugOutputPath } = params;

  const defaultEnv = createBaseEnvironmentConfig({
    entry: { index: fixturePath },
    outputDir: path.dirname(outputPath),
    filename: path.basename(outputPath),
    minify: true,
  });

  if (!debugOutputPath) {
    return { default: defaultEnv };
  }

  return {
    default: defaultEnv,
    debug: createBaseEnvironmentConfig({
      entry: { index: fixturePath },
      outputDir: path.dirname(debugOutputPath),
      filename: path.basename(debugOutputPath),
      minify: false,
    }),
  };
}

export function createMultiEntryEnvironmentConfig(params: {
  fixtures: Array<{ fixturePath: string; outputPath: string; debugOutputPath?: string }>;
  debug: boolean;
}): Record<string, EnvironmentConfig> {
  const { fixtures, debug } = params;

  const outputDir = path.dirname(fixtures[0].outputPath);

  const entry = fixtures.reduce<Record<string, string>>((acc, { fixturePath, outputPath }) => {
    const entryName = path.basename(outputPath, path.extname(outputPath));
    acc[entryName] = fixturePath;
    return acc;
  }, {});

  const defaultEnv = createBaseEnvironmentConfig({
    entry,
    outputDir,
    filename: '[name].js',
    minify: true,
  });

  if (!debug) {
    return { default: defaultEnv };
  }

  const debugEntry = fixtures.reduce<Record<string, string>>((acc, { fixturePath, debugOutputPath }) => {
    if (debugOutputPath) {
      const entryName = path.basename(debugOutputPath, path.extname(debugOutputPath));
      acc[entryName] = fixturePath;
    }
    return acc;
  }, {});

  return {
    default: defaultEnv,
    debug: createBaseEnvironmentConfig({
      entry: debugEntry,
      outputDir,
      filename: '[name].js',
      minify: false,
    }),
  };
}

export function createRspackBundler(configEnhancerCallback = DEFAULT_CONFIG_ENHANCER): BundlerAdapter {
  return {
    buildFixture: async function (options) {
      const { debug, fixturePath } = options;

      // Silence the default logger
      logger.level = 'error';

      const rootDir = path.dirname(fixturePath);
      const artifactsDir = path.join(rootDir, 'dist');
      const fixtureName = path.basename(fixturePath);

      const outputPath = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.output.js'));
      const debugOutputPath = path.join(artifactsDir, fixtureName.replace(/\.fixture.js$/, '.debug.js'));

      const rsbuild = await createRsbuild({
        loadEnv: false,
        rsbuildConfig: configEnhancerCallback({
          root: rootDir,
          mode: 'production',
          dev: { progressBar: false },
          environments: createEnvironmentConfig({
            fixturePath,
            outputPath,

            ...(debug && { debugOutputPath }),
          }),
        }),
      });
      const buildResult = await rsbuild.build({ watch: false });

      await buildResult.close();

      return {
        outputPath,
        ...(debug && { debugOutputPath }),
      };
    },

    buildFixtures: async function (options) {
      const { debug, fixtures } = options;

      // Silence the default logger
      logger.level = 'error';

      // Prepare output paths for all fixtures
      const fixturesWithPaths = fixtures.map(({ fixturePath, name }) => {
        const rootDir = path.dirname(fixturePath);
        const artifactsDir = path.join(rootDir, 'dist');
        const fixtureName = path.basename(fixturePath);

        return {
          fixturePath,
          name,
          outputPath: path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.output.js')),
          debugOutputPath: path.join(artifactsDir, fixtureName.replace(/\.fixture.js$/, '.debug.js')),
        };
      });

      // Use the root directory of the first fixture for the build
      const rootDir = path.dirname(fixtures[0].fixturePath);

      // Build all fixtures in a single rsbuild run
      const rsbuild = await createRsbuild({
        loadEnv: false,
        rsbuildConfig: configEnhancerCallback({
          root: rootDir,
          mode: 'production',
          dev: { progressBar: false },
          environments: createMultiEntryEnvironmentConfig({
            fixtures: fixturesWithPaths,
            debug,
          }),
        }),
      });

      const buildResult = await rsbuild.build({ watch: false });
      await buildResult.close();

      return fixturesWithPaths.map(({ name, outputPath, debugOutputPath }) => ({
        name,
        outputPath,
        ...(debug && {
          debugOutputPath,
        }),
      }));
    },

    name: 'Rsbuild',
  };
}
