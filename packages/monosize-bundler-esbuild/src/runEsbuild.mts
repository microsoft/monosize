import fs from 'node:fs/promises';
import path from 'node:path';
import { build, type BuildOptions } from 'esbuild';

import { EsbuildBundlerOptions } from './types.mjs';

function createEsbuildConfig(fixturePath: string): BuildOptions {
  return {
    logLevel: 'silent',

    entryPoints: [fixturePath],

    minify: true,
    bundle: true,

    write: false,
  };
}

type RunEsbuildOptions = {
  enhanceConfig: EsbuildBundlerOptions;

  fixturePath: string;
  outputPath: string;

  quiet: boolean;
};

export async function runEsbuild(options: RunEsbuildOptions): Promise<null> {
  const { enhanceConfig, fixturePath, outputPath } = options;
  const esbuildConfig = enhanceConfig(createEsbuildConfig(fixturePath));

  const result = await build(esbuildConfig);
  const { outputFiles } = result;

  if (!outputFiles || outputFiles.length !== 1) {
    throw new Error('Expected exactly one output file');
  }

  await fs.writeFile(outputPath, outputFiles[0].contents);

  return null;
}

type RunEsbuildMultiEntryOptions = {
  enhanceConfig: EsbuildBundlerOptions;

  fixtures: Array<{ fixturePath: string; outputPath: string }>;

  quiet: boolean;
};

export async function runEsbuildMultiEntry(options: RunEsbuildMultiEntryOptions): Promise<null> {
  const { enhanceConfig, fixtures } = options;

  // All fixtures should output to the same directory
  const outputDir = path.dirname(fixtures[0].outputPath);

  // Build entry object with keys derived from output filenames
  const entryPoints = fixtures.reduce<Record<string, string>>((acc, { fixturePath, outputPath }) => {
    const entryName = path.basename(outputPath, path.extname(outputPath));
    acc[entryName] = fixturePath;
    return acc;
  }, {});

  const esbuildConfig = enhanceConfig({
    logLevel: 'silent',

    entryPoints,

    minify: true,
    bundle: true,

    outdir: outputDir,
    outExtension: { '.js': '.js' },
  });

  await build(esbuildConfig);

  return null;
}
