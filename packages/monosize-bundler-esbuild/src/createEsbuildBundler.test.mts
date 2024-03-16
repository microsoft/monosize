import fs from 'node:fs/promises';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createEsbuildBundler } from './createEsbuildBundler.mjs';

async function setup(fixtureContent: string): Promise<string> {
  const packageDir = tmp.dirSync({
    prefix: 'buildFixture',
    unsafeCleanup: true,
  });

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir.name);

  const fixtureDir = tmp.dirSync({
    dir: packageDir.name,
    name: 'monosize',
    unsafeCleanup: true,
  });
  const fixture = tmp.fileSync({
    dir: fixtureDir.name,
    name: 'test.fixture.js',
  });

  await fs.writeFile(fixture.name, fixtureContent);

  return fs.realpath(fixture.name);
}

const viteBundler = createEsbuildBundler();

describe('buildFixture', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures', async () => {
    const fixturePath = await setup(`
    const hello = 'Hello world';
    const world = 'World';

    console.log(hello)
    `);
    const buildResult = await viteBundler.buildFixture({
      debug: false,
      fixturePath,
      quiet: true,
    });

    expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);
    expect(await fs.readFile(buildResult.outputPath, 'utf-8')).toMatchInlineSnapshot(`
      "(()=>{var o=\\"Hello world\\";console.log(o);})();
      "
    `);
  });

  it('should throw on compilation errors', async () => {
    const fixturePath = await setup(`import something from 'unknown-pkg'`);

    await expect(
      viteBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      }),
    ).rejects.toContain(/failed to resolve import "unknown-pkg" from/);
  });
});
