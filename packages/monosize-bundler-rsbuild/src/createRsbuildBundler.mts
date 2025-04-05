import path from 'node:path';
import { createRsbuild, type EnvironmentConfig, type RsbuildConfig, logger } from '@rsbuild/core';
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
      };

      const rsbuild = await createRsbuild({
        cwd: rootDir,
        environment: [debug && 'debug', 'default'].filter(Boolean) as string[],
        loadEnv: false,

        rsbuildConfig: configEnhancerCallback({
          root: rootDir,
          mode: 'production',

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
    name: 'Rsbuild',
  };
}
