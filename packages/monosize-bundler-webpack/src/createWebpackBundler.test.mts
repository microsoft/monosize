import fs from 'node:fs';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createWebpackBundler } from './createWebpackBundler.mjs';

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

  await fs.promises.writeFile(fixture.name, fixtureContent);

  return fixture.name;
}

const webpackBundler = createWebpackBundler(config => {
  // Disable pathinfo to make the output deterministic in snapshots
  config.output ??= {};
  config.output.pathinfo = false;

  return config;
});

describe('buildFixture', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures', async () => {
    const fixturePath = await setup(`
      const hello = 'Hello';
      const world = 'world';

      console.log(hello);
    `);
    const buildResult = await webpackBundler.buildFixture({
      debug: false,
      fixturePath,
      quiet: true,
    });

    expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);
    expect(await fs.promises.readFile(buildResult.outputPath, 'utf-8')).toMatchInlineSnapshot(
      '"console.log(\\"Hello\\");"',
    );
  });

  it('should throw on compilation errors', async () => {
    const fixturePath = await setup(`import something from 'unknown-pkg'`);
    await expect(
      webpackBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      }),
    ).rejects.toBeDefined();
  });

  describe('debug mode', () => {
    it('does not output additional files when disabled', async () => {
      const fixturePath = await setup(`
      const tokens = {
        foo: 'foo',
        bar: 'bar',
      };
      function foo () { return tokens.foo; }
      const bar = 1;

      console.log(foo);
    `);
      const buildResult = await webpackBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      });
      const output = await fs.promises.readFile(buildResult.outputPath, 'utf-8');

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toBeUndefined();

      expect(output).toMatchInlineSnapshot('"(()=>{const o=\\"foo\\";console.log((function(){return o}))})();"');
    });

    it('provides partially minified output when enabled', async () => {
      const fixturePath = await setup(`
      const tokens = {
        foo: 'foo',
        bar: 'bar',
      };
      function foo () { return tokens.foo; }
      const bar = 1;

      console.log(foo);
    `);
      const buildResult = await webpackBundler.buildFixture({
        debug: true,
        fixturePath,
        quiet: true,
      });

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toMatch(/monosize[\\|/]test\.debug\.js/);

      const output = await fs.promises.readFile(buildResult.outputPath, 'utf-8');
      const debugOutput = await fs.promises.readFile(buildResult.debugOutputPath!, 'utf-8');

      expect(output).toMatchInlineSnapshot('"(()=>{const o=\\"foo\\";console.log((function(){return o}))})();"');

      // Output should contain the original variable names
      expect(debugOutput).toMatchInlineSnapshot(`
      "/******/ (() => {
          const tokens_foo = \\"foo\\";
          console.log((function() {
              return tokens_foo;
          }));
      })
      /******/ ();"
    `);
    });
  });
});
