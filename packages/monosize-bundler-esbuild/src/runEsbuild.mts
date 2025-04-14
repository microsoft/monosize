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
