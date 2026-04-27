import fs from 'node:fs';
import path from 'node:path';
import { build, type InlineConfig } from 'vite';
import type { BundlerAdapter, BundlerAdapterFactoryConfig } from 'monosize';

const DEFAULT_CONFIG_ENHANCER: BundlerAdapterFactoryConfig<InlineConfig> = config => config;

export function createBaseConfig(params: {
  root: string;
  fixturePath: string;
  outDir: string;
  fileName: string;
  minify: boolean;
}): InlineConfig {
  const { root, fixturePath, outDir, fileName, minify } = params;

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

      outDir,

      lib: {
        entry: fixturePath,
        // `es` (instead of iife) so rollup reliably extracts CSS into a sidecar
        // when the fixture imports it. `lib.name` and `rollupOptions.output.globals`
        // are iife/umd-only concepts and don't apply to es.
        formats: ['es'],
        fileName: () => fileName,
      },

      rollupOptions: {
        external: ['react', 'react-dom'],
        output: {
          // Keep extracted CSS / asset sidecars at outDir root rather than under
          // a nested `assets/` dir — the CLI walks outputDir non-recursively.
          assetFileNames: '[name][extname]',
        },
      },
    },
  };
}

async function buildSingleFixture(
  configEnhancer: BundlerAdapterFactoryConfig<InlineConfig>,
  fixturePath: string,
  debug: boolean,
): Promise<{ outputDir: string; debugOutputPath?: string }> {
  const rootDir = path.dirname(fixturePath);
  const artifactsDir = path.join(rootDir, 'dist');
  const fixtureName = path.basename(fixturePath);

  const outputDir = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.output'));
  const debugOutputPath = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.debug.js'));

  await build(
    configEnhancer(
      createBaseConfig({ root: rootDir, fixturePath, outDir: outputDir, fileName: 'index.js', minify: true }),
    ),
  );

  if (debug) {
    // Run the debug build into a transient dir, then move just the JS file to
    // a flat `.debug.js` sibling of outputDir so the CLI's extension scan
    // doesn't double-count the beautified copy as a JS asset.
    const debugScratchDir = path.join(artifactsDir, fixtureName.replace(/\.fixture\.js$/, '.debug-tmp'));
    await build(
      configEnhancer(
        createBaseConfig({ root: rootDir, fixturePath, outDir: debugScratchDir, fileName: 'index.js', minify: false }),
      ),
    );
    await fs.promises.rename(path.join(debugScratchDir, 'index.js'), debugOutputPath);
    await fs.promises.rm(debugScratchDir, { recursive: true, force: true });
  }

  return {
    outputDir,
    ...(debug && { debugOutputPath }),
  };
}

export function createViteBundler(
  configEnhancerCallback: BundlerAdapterFactoryConfig<InlineConfig> = DEFAULT_CONFIG_ENHANCER,
): BundlerAdapter {
  return {
    buildFixture: options => buildSingleFixture(configEnhancerCallback, options.fixturePath, options.debug),

    // Vite/Rollup does not natively support emitting multiple self-contained es
    // bundles from a single build. Until we have a better story, we just iterate
    // sequentially. Per-fixture isolation is automatic since each fixture gets
    // its own outputDir.
    buildFixtures: async options => {
      const { debug, fixtures } = options;
      const results: Array<{ name: string; outputDir: string; debugOutputPath?: string }> = [];

      for (const { fixturePath, name } of fixtures) {
        const result = await buildSingleFixture(configEnhancerCallback, fixturePath, debug);
        results.push({ name, ...result });
      }

      return results;
    },

    name: 'Vite',
  };
}
