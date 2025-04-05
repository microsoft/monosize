import path from 'node:path';
import { createRsbuild, type EnvironmentConfig, type RsbuildConfig, logger } from '@rsbuild/core';
import type { BundlerAdapter, BundlerAdapterFactoryConfig } from 'monosize';

const DEFAULT_CONFIG_ENHANCER: BundlerAdapterFactoryConfig<RsbuildConfig> = config => config;

export function createEnvironmentConfig(params: {
  fixturePath: string;
  outputPath: string;
  debugOutputPath?: string;
}): Record<string, EnvironmentConfig> {
  const { fixturePath, outputPath, debugOutputPath } = params;
  const environmentConfig: EnvironmentConfig = {
    source: {
      entry: {
        index: fixturePath,
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
        js: path.basename(outputPath),
      },
      distPath: {
        root: path.dirname(outputPath),
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

  return {
    default: environmentConfig,

    ...(debugOutputPath && {
      debug: {
        ...environmentConfig,

        output: {
          ...environmentConfig.output,
          filename: {
            js: path.basename(debugOutputPath),
          },
          minify: false,
        },
      },
    }),
  };
}

export function createRsbuildBundler(configEnhancerCallback = DEFAULT_CONFIG_ENHANCER): BundlerAdapter {
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

    name: 'Rsbuild',
  };
}
