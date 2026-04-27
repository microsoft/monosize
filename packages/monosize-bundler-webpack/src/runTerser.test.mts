import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { runTerser } from './runTerser.mjs';

async function setup(fixtureContent: string): Promise<Parameters<typeof runTerser>[0]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runTerser'));
  const sourcePath = path.resolve(tmpDir, 'test.fixture.js');

  await fs.promises.writeFile(sourcePath, fixtureContent);

  return {
    fixturePath: 'test.fixture.js', // This is a placeholder, it's not used in the test
    quiet: true,

    sourcePath,
    debugOutputPath: path.resolve(tmpDir, 'test.debug.js'),
    outputPath: path.resolve(tmpDir, 'test.output.js'),
  };
}

describe('runTerser', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('performs minification', async () => {
    const options = await setup(`
      const hello = 'Hello';
      const world = 'world';

      console.log(hello);
    `);
    await runTerser(options);

    expect(await fs.promises.readFile(options.outputPath, 'utf-8')).toMatchInlineSnapshot(
      `"const hello="Hello",world="world";console.log(hello);"`,
    );
    expect(await fs.promises.readFile(options.debugOutputPath, 'utf-8')).toMatchInlineSnapshot(
      `
      "const hello = "Hello", world = "world";

      console.log(hello);"
    `,
    );
  });

  it('should throw on compilation errors', async () => {
    const options = await setup(`import something from "unknown-pkg'`);
    await expect(runTerser(options)).rejects.toMatchInlineSnapshot('[SyntaxError: Unterminated string constant]');
  });
});
