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
      minify,

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

async function buildSingleFixture(
  configEnhancer: BundlerAdapterFactoryConfig<InlineConfig>,
  fixturePath: string,
  debug: boolean,
): Promise<{ outputPath: string; debugOutputPath?: string }> {
  const rootDir = path.dirname(fixturePath);
  const artifactsDir = path.join(rootDir, 'dist');
  const fixtureName = path.basename(fixturePath);

  const outputPath = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.output.js'));
  const debugOutputPath = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.debug.js'));

  await build(
    configEnhancer(createBaseConfig({ root: rootDir, fixturePath, outputPath, minify: true })),
  );

  if (debug) {
    await build(
      configEnhancer(createBaseConfig({ root: rootDir, fixturePath, outputPath: debugOutputPath, minify: false })),
    );
  }

  return {
    outputPath,
    ...(debug && { debugOutputPath }),
  };
}

export function createViteBundler(
  configEnhancerCallback: BundlerAdapterFactoryConfig<InlineConfig> = DEFAULT_CONFIG_ENHANCER,
): BundlerAdapter {
  return {
    buildFixture: options => buildSingleFixture(configEnhancerCallback, options.fixturePath, options.debug),

    // Vite/Rollup does not natively support emitting multiple self-contained iife bundles
    // from a single build. Until we have a better story, we just iterate sequentially.
    buildFixtures: async options => {
      const { debug, fixtures } = options;
      const results: Array<{ name: string; outputPath: string; debugOutputPath?: string }> = [];

      for (const { fixturePath, name } of fixtures) {
        const result = await buildSingleFixture(configEnhancerCallback, fixturePath, debug);
        results.push({ name, ...result });
      }

      return results;
    },

    name: 'Vite',
  };
}
