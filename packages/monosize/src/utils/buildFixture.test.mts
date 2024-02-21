import fs from 'node:fs';
import path from 'node:path';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { buildFixture } from './buildFixture.mjs';
import type { PreparedFixture } from './prepareFixture.mjs';
import type { MonoSizeConfig } from '../types.mjs';

async function setup(fixtureContent: string): Promise<PreparedFixture> {
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

  return {
    absolutePath: fixture.name,
    relativePath: path.relative(packageDir.name, fixture.name),

    name: 'Test fixture',
  };
}

const config: MonoSizeConfig = {
  repository: '',
  storage: {
    getRemoteReport: vitest.fn(),
    uploadReportToRemote: vitest.fn(),
  },
  webpack: config => {
    // Disable pathinfo to make the output deterministic in snapshots
    config.output!.pathinfo = false;

    return config;
  },
};

describe('buildFixture', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures and returns minified & GZIP sizes', async () => {
    const fixture = await setup(`console.log('Hello world')`);
    const buildResult = await buildFixture({ preparedFixture: fixture, debug: false, config, quiet: true });

    expect(buildResult.name).toBe('Test fixture');
    expect(buildResult.path).toMatch(/monosize[\\|/]test\.fixture\.js/);
    expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);

    expect(buildResult.minifiedSize).toBeGreaterThan(1);
    expect(buildResult.gzippedSize).toBeGreaterThan(1);
  });

  it('should throw on compilation errors', async () => {
    const fixture = await setup(`import something from 'unknown-pkg'`);
    await expect(
      buildFixture({
        preparedFixture: fixture,
        debug: false,
        config,
        quiet: true,
      }),
    ).rejects.toBeDefined();
  });

  describe('debug mode', () => {
    it('does not output additional files when disabled', async () => {
      const fixture = await setup(`
      const tokens = {
        foo: 'foo',
        bar: 'bar',
      };
      function foo () { return tokens.foo; }
      const bar = 1;

      console.log(foo);
    `);
      const buildResult = await buildFixture({
        preparedFixture: fixture,
        debug: false,
        config,
        quiet: true,
      });
      const output = await fs.promises.readFile(buildResult.outputPath, 'utf-8');

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toBeUndefined();

      expect(output).toMatchInlineSnapshot('"(()=>{const o=\\"foo\\";console.log((function(){return o}))})();"');
    });

    it('provides partially minified output when enabled', async () => {
      const fixture = await setup(`
      const tokens = {
        foo: 'foo',
        bar: 'bar',
      };
      function foo () { return tokens.foo; }
      const bar = 1;

      console.log(foo);
    `);
      const buildResult = await buildFixture({
        preparedFixture: fixture,
        debug: true,
        config,
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
