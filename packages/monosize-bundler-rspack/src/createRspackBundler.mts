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
  outputDir: string;
  debugOutputPath?: string;
}): Record<string, EnvironmentConfig> {
  const { fixturePath, outputDir, debugOutputPath } = params;

  const defaultEnv = createBaseEnvironmentConfig({
    entry: { index: fixturePath },
    outputDir,
    filename: 'index.js',
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
  fixtures: Array<{ fixturePath: string; outputDir: string; debugOutputPath?: string }>;
  debug: boolean;
}): Record<string, EnvironmentConfig> {
  const { fixtures, debug } = params;

  // Each fixture's outputDir lives under a shared dist root; rspack writes
  // <sharedRoot>/<entryName>/index.js where entryName is the basename of
  // the per-fixture outputDir (e.g. "foo.output").
  const sharedRoot = path.dirname(fixtures[0].outputDir);

  const entry = fixtures.reduce<Record<string, string>>((acc, { fixturePath, outputDir }) => {
    acc[path.basename(outputDir)] = fixturePath;
    return acc;
  }, {});

  const defaultEnv = createBaseEnvironmentConfig({
    entry,
    outputDir: sharedRoot,
    filename: '[name]/index.js',
    minify: true,
  });

  if (!debug) {
    return { default: defaultEnv };
  }

  // Debug build emits a flat <sharedRoot>/<entryName>.debug.js per fixture
  // (sibling to each outputDir, not inside it).
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
      outputDir: sharedRoot,
      filename: '[name].js',
      minify: false,
    }),
  };
}

export function createRspackBundler(configEnhancerCallback: BundlerAdapterFactoryConfig<RsbuildConfig> = DEFAULT_CONFIG_ENHANCER): BundlerAdapter {
  return {
    buildFixture: async function (options) {
      const { debug, fixturePath } = options;

      // Silence the default logger
      logger.level = 'error';

      const rootDir = path.dirname(fixturePath);
      const artifactsDir = path.join(rootDir, 'dist');
      const fixtureName = path.basename(fixturePath);

      const outputDir = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.output'));
      const debugOutputPath = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.debug.js'));

      const rsbuild = await createRsbuild({
        loadEnv: false,
        rsbuildConfig: configEnhancerCallback({
          root: rootDir,
          mode: 'production',
          dev: { progressBar: false },
          environments: createEnvironmentConfig({
            fixturePath,
            outputDir,

            ...(debug && { debugOutputPath }),
          }),
        }),
      });
      const buildResult = await rsbuild.build({ watch: false });

      await buildResult.close();

      return {
        outputDir,
        ...(debug && { debugOutputPath }),
      };
    },

    buildFixtures: async function (options) {
      const { debug, fixtures } = options;

      // Silence the default logger
      logger.level = 'error';

      // Prepare output paths for all fixtures (one outputDir per fixture).
      const fixturesWithPaths = fixtures.map(({ fixturePath, name }) => {
        const rootDir = path.dirname(fixturePath);
        const artifactsDir = path.join(rootDir, 'dist');
        const fixtureName = path.basename(fixturePath);

        return {
          fixturePath,
          name,
          outputDir: path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.output')),
          debugOutputPath: path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.debug.js')),
        };
      });

      // Use the root directory of the first fixture for the build
      const rootDir = path.dirname(fixtures[0].fixturePath);

      // Build all fixtures in batch mode
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

      return fixturesWithPaths.map(({ name, outputDir, debugOutputPath }) => ({
        name,
        outputDir,
        ...(debug && {
          debugOutputPath,
        }),
      }));
    },

    name: 'Rsbuild',
  };
}
