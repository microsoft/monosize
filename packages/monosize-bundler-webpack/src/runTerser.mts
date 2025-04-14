import fs from 'node:fs';
import { minify } from 'terser';

type RunTerserOptions = {
  fixturePath: string;

  sourcePath: string;
  outputPath: string;
  debugOutputPath: string;

  quiet: boolean;
};

export async function runTerser(options: RunTerserOptions) {
  const { fixturePath, debugOutputPath, sourcePath, outputPath } = options;
  const sourceContent = await fs.promises.readFile(sourcePath, 'utf8');

  // Performs only dead-code elimination
  const debugOutput = await minify(
    { [fixturePath]: sourceContent },
    {
      compress: {},
      mangle: false,
      format: {
        beautify: true,
        comments: true,
        preserve_annotations: true,
      },
      sourceMap: false,
    },
  );
  // Performs full minification
  const minifiedOutput = await minify(
    { [fixturePath]: sourceContent },
    {
      format: {
        comments: false,
      },
      sourceMap: false,
    },
  );

  if (!debugOutput.code || !minifiedOutput.code) {
    throw new Error('Got an empty output from Terser, this is not expected...');
  }

  await fs.promises.writeFile(debugOutputPath, debugOutput.code);
  await fs.promises.writeFile(outputPath, minifiedOutput.code);
}
