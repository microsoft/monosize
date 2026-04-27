import path from 'node:path';
import { build, type InlineConfig } from 'vite';
import type { BundlerAdapter, BundlerAdapterFactoryConfig } from 'monosize';

const DEFAULT_CONFIG_ENHANCER: BundlerAdapterFactoryConfig<InlineConfig> = config => config;

export function createBaseConfig(params: {
  root: string;
  fixturePath: string;
  outputPath: string;
  minify: boolean;
}): InlineConfig {
  const { root, fixturePath, outputPath, minify } = params;

  return {
    configFile: false,
    envFile: false,
    root,
    logLevel: 'silent',

    build: {
      write: true,
      emptyOutDir: false,
      copyPublicDir: false,
      reportCompressedSize: false,
      modulePreload: false,

      target: 'esnext',
      minify: minify ? 'esbuild' : false,

      outDir: path.dirname(outputPath),

      lib: {
        entry: fixturePath,
        formats: ['iife'],
        name: '__monosizeFixture',
        fileName: () => path.basename(outputPath),
      },

      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          globals: {
            react: 'React',
            'react-dom': 'ReactDOM',
          },
        },
      },
    },
  };
}

export function createViteBundler(
  configEnhancerCallback: BundlerAdapterFactoryConfig<InlineConfig> = DEFAULT_CONFIG_ENHANCER,
): BundlerAdapter {
  return {
    buildFixture: async function (options) {
      const { debug, fixturePath } = options;

      const rootDir = path.dirname(fixturePath);
      const artifactsDir = path.join(rootDir, 'dist');
      const fixtureName = path.basename(fixturePath);

      const outputPath = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.output.js'));
      const debugOutputPath = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.debug.js'));

      await build(
        configEnhancerCallback(
          createBaseConfig({ root: rootDir, fixturePath, outputPath, minify: true }),
        ),
      );

      if (debug) {
        await build(
          configEnhancerCallback(
            createBaseConfig({ root: rootDir, fixturePath, outputPath: debugOutputPath, minify: false }),
          ),
        );
      }

      return {
        outputPath,
        ...(debug && { debugOutputPath }),
      };
    },

    buildFixtures: async function (options) {
      const { debug, fixtures } = options;

      const fixturesWithPaths = fixtures.map(({ fixturePath, name }) => {
        const rootDir = path.dirname(fixturePath);
        const artifactsDir = path.join(rootDir, 'dist');
        const fixtureName = path.basename(fixturePath);

        return {
          fixturePath,
          name,
          rootDir,
          outputPath: path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.output.js')),
          debugOutputPath: path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.debug.js')),
        };
      });

      const builds: Array<Promise<unknown>> = [];

      for (const { rootDir, fixturePath, outputPath, debugOutputPath } of fixturesWithPaths) {
        builds.push(
          build(
            configEnhancerCallback(
              createBaseConfig({ root: rootDir, fixturePath, outputPath, minify: true }),
            ),
          ),
        );

        if (debug) {
          builds.push(
            build(
              configEnhancerCallback(
                createBaseConfig({ root: rootDir, fixturePath, outputPath: debugOutputPath, minify: false }),
              ),
            ),
          );
        }
      }

      await Promise.all(builds);

      return fixturesWithPaths.map(({ name, outputPath, debugOutputPath }) => ({
        name,
        outputPath,
        ...(debug && { debugOutputPath }),
      }));
    },

    name: 'Vite',
  };
}
