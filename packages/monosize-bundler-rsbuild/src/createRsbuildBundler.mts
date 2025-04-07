import path from 'node:path';
import { createRsbuild, type EnvironmentConfig, type RsbuildConfig, logger, CreateRsbuildOptions } from '@rsbuild/core';
import type { BundlerAdapter, BundlerAdapterFactoryConfig } from 'monosize';

const DEFAULT_CONFIG_ENHANCER: BundlerAdapterFactoryConfig<RsbuildConfig> = config => config;

function createEntironmentConfig(params: {
  rootDir: string;
  fixturePath: string;
  fixtureName: string;
  outputDir: string;
  outputName: string;
  debugOutputName: string;
  debug?: boolean;
}): Record<string, EnvironmentConfig> {
  const { rootDir, fixturePath, fixtureName, outputDir, outputName, debugOutputName, debug } = params;

  const environmentConfig: EnvironmentConfig = {
    source: {
      entry: {
        index: path.resolve(rootDir, fixturePath),
      },
    },

    output: {
      externals: {
        react: 'React',
        'react-dom': 'ReactDOM',
      },
      target: 'web',

      emitAssets: false,

      filename: {
        js: outputName,
      },
      distPath: {
        root: outputDir,
        js: './',
      },

      // minify: true,
    },

    performance: {
      chunkSplit: {
        strategy: 'all-in-one',
      },
    },
  };

  const envName = fixtureName.replace(/\.fixture\.js$/, '');
  const debugEnvName = `${envName}:debug`;

  const fixtureConfigs = {
    [envName]: environmentConfig,

    ...(debug && {
      [debugEnvName]: {
        ...environmentConfig,

        output: {
          ...environmentConfig.output,
          filename: {
            js: debugOutputName,
          },
          minify: false,
        },
      },
    }),
  };

  return fixtureConfigs;
}

async function runRsbuild(params: {
  rootDir: string;
  environments: Record<string, EnvironmentConfig>;
  configEnhancerCallback: BundlerAdapterFactoryConfig<RsbuildConfig>;
}): Promise<void> {
  const { rootDir, environments, configEnhancerCallback } = params;

  const rsbuild = await createRsbuild({
    loadEnv: false,

    rsbuildConfig: configEnhancerCallback({
      root: rootDir,
      mode: 'production',

      dev: {
        progressBar: false,
      },

      environments,
    }),
  });

  const buildResult = await rsbuild.build({
    watch: false,
  });

  await buildResult.close();
}

export function createRsbuildBundler(configEnhancerCallback = DEFAULT_CONFIG_ENHANCER): BundlerAdapter {
  return {
    buildFixture: async function (options) {
      const { debug, fixturePath } = options;

      // Silence
      logger.level = 'error';

      const rootDir = path.dirname(fixturePath);
      const outputDir = path.join(rootDir, 'dist');

      const fixtureName = path.basename(fixturePath);
      const outputName = fixtureName.replace(/\.fixture\.js$/, '.output.js');
      const debugOutputName = fixtureName.replace(/\.fixture.js$/, '.debug.js');

      const outputPath = path.join(outputDir, outputName);
      const debugOutputPath = path.join(outputDir, debugOutputName);

      await runRsbuild({
        rootDir,
        environments: createEntironmentConfig({
          rootDir,
          fixturePath,
          fixtureName,
          outputDir,
          outputName,
          debugOutputName,

          debug,
        }),
        configEnhancerCallback,
      });

      return {
        outputPath,
        ...(debug && {
          debugOutputPath,
        }),
      };
    },

    buildFixtures: async function (options) {
      const { debug, rootDir, fixturePaths } = options;

      // Silence
      logger.level = 'error';

      const assets = fixturePaths.map(fixturePath => {
        const fixtureName = path.basename(fixturePath);
        const fixtureNameWithoutExt = fixtureName.replace(/\.fixture\.js$/, '');

        const outputDir = path.join(rootDir, 'dist', fixtureNameWithoutExt);

        const outputName = fixtureName.replace(/\.fixture\.js$/, '.output.js');
        const debugOutputName = fixtureName.replace(/\.fixture.js$/, '.debug.js');

        return {
          outputDir,
          fixturePath,
          fixtureName,
          outputName,
          debugOutputName,

          outputPath: path.join(outputDir, outputName),
          ...(debug && {
            debugOutputPath: path.join(outputDir, debugOutputName),
          }),
        };
      });

      const environments = assets.reduce<Record<string, EnvironmentConfig>>((acc, asset) => {
        const { outputDir, fixtureName, fixturePath, outputName, debugOutputName } = asset;

        return {
          ...acc,
          ...createEntironmentConfig({
            rootDir,
            fixturePath,
            fixtureName,
            outputDir,
            outputName,
            debugOutputName,

            debug,
          }),
        };
      }, {});

      await runRsbuild({
        rootDir,
        environments,
        configEnhancerCallback,
      });

      return assets.map(asset => ({
        fixturePath: asset.fixturePath,
        outputPath: asset.outputPath,
        ...(debug && {
          debugOutputPath: asset.debugOutputPath,
        }),
      }));
    },

    name: 'Rsbuild',
  };
}
