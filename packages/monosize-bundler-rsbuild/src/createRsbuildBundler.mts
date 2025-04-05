import path from 'node:path';
import { createRsbuild, type EnvironmentConfig, type RsbuildConfig, logger, CreateRsbuildOptions } from '@rsbuild/core';
import type { BundlerAdapter, BundlerAdapterFactoryConfig } from 'monosize';

const DEFAULT_CONFIG_ENHANCER: BundlerAdapterFactoryConfig<RsbuildConfig> = config => config;

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

      const rsbuildConfig: EnvironmentConfig = {
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

          minify: true,
        },

        performance: {
          chunkSplit: {
            strategy: 'all-in-one',
          },
        },
      };

      const rsbuild = await createRsbuild({
        cwd: rootDir,
        environment: [debug && 'debug', 'default'].filter(Boolean) as string[],
        loadEnv: false,

        rsbuildConfig: configEnhancerCallback({
          root: rootDir,
          mode: 'production',

          dev: {
            progressBar: false,
          },

          environments: {
            default: rsbuildConfig,
            debug: {
              ...rsbuildConfig,

              output: {
                ...rsbuildConfig.output,
                filename: {
                  js: debugOutputName,
                },
                minify: false,
              },
            },
          },
        }),
      });

      const buildResult = await rsbuild.build({
        watch: false,
      });

      await buildResult.close();

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

      const environmentConfigs = assets.reduce<Record<string, EnvironmentConfig>>((acc, asset) => {
        const { outputDir, fixtureName, fixturePath, outputName, debugOutputName } = asset;

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

            minify: true,
          },

          performance: {
            chunkSplit: {
              strategy: 'all-in-one',
            },
          },
        };

        const envName = fixtureName.replace(/\.fixture\.js$/, '');
        const debugEnvName = `${envName}.debug`;

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

        return {
          ...acc,
          ...fixtureConfigs,
        };
      }, {});

      const rsbuild = await createRsbuild({
        loadEnv: false,
        rsbuildConfig: configEnhancerCallback({
          root: rootDir,
          mode: 'production',

          dev: {
            progressBar: false,
          },
          environments: environmentConfigs,
        }),
      });
      const buildResult = await rsbuild.build({
        watch: false,
      });

      await buildResult.close();

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
