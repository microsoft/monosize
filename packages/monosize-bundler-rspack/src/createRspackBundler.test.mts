import fs from 'node:fs';
import prettier from 'prettier';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createEnvironmentConfig, createRspackBundler } from './createRspackBundler.mjs';

async function setup(content: string): Promise<string> {
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
  const fixtureFile = tmp.fileSync({
    dir: fixtureDir.name,
    name: 'test.fixture.js',
  });

  await fs.promises.writeFile(fixtureFile.name, content);

  return fixtureFile.name;
}

async function prepareOutput(outputPath: string): Promise<string> {
  return await prettier.format(fs.readFileSync(outputPath, 'utf-8'), {
    filepath: outputPath,
  });
}

describe('createEnvironmentConfig', () => {
  it('creates a config with the correct environment', () => {
    expect(
      createEnvironmentConfig({
        fixturePath: '/workspace/fixtures/my-fixture.js',
        outputPath: '/workspace/dist/my-fixture.js',
      }),
    ).toMatchInlineSnapshot(`
      {
        "default": {
          "output": {
            "distPath": {
              "js": "./",
              "root": "/workspace/dist",
            },
            "emitAssets": false,
            "externals": {
              "react": "React",
              "react-dom": "ReactDOM",
            },
            "filename": {
              "js": "my-fixture.js",
            },
            "minify": true,
            "target": "web",
          },
          "performance": {
            "chunkSplit": {
              "strategy": "all-in-one",
            },
          },
          "source": {
            "entry": {
              "index": "/workspace/fixtures/my-fixture.js",
            },
          },
        },
      }
    `);
  });
});

describe('buildFixture', () => {
  const rspackBundler = createRspackBundler(config => {
    // Specific config to get minification output consistent on *nix/Windows

    for (const environment in config.environments) {
      if (environment === 'debug') {
        config.environments['debug'] ??= {};
        config.environments['debug'].output ??= {};
        config.environments['debug'].output.minify = {
          js: true,
          jsOptions: {
            minimizerOptions: {
              compress: false,
              mangle: false,
              minify: true,
            },
          },
        };
      }
    }

    return config;
  });

  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures', async () => {
    const fixturePath = await setup(`const hello = 'Hello'; console.log(hello);`);
    const result = await rspackBundler.buildFixture({
      debug: false,
      fixturePath,
      quiet: true,
    });
    const output = await prepareOutput(result.outputPath);

    expect(result.outputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.output\.js/);
    expect(output).toMatchSnapshot();
  });

  it('should throw on compilation errors', async () => {
    const fixturePath = await setup(`console..log(hello);`);

    await expect(
      rspackBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      }),
    ).rejects.toMatchInlineSnapshot(`[Error: Rspack build failed.]`);
  });

  describe('debug mode', () => {
    it('does not output additional files when disabled', async () => {
      const fixturePath = await setup(`
        const tokens = { foo: 'foo', bar: 'bar' };
        function foo () { return tokens.foo; }
        const bar = 1;
        console.log(foo);
      `);
      const buildResult = await rspackBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      });
      const output = await prepareOutput(buildResult.outputPath);

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toBeUndefined();

      expect(output).toMatchSnapshot();
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
      const buildResult = await rspackBundler.buildFixture({
        debug: true,
        fixturePath,
        quiet: true,
      });

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.debug\.js/);

      const output = await prepareOutput(buildResult.outputPath);
      const debugOutput = await prepareOutput(buildResult.debugOutputPath as string);

      expect(output).toMatchSnapshot();
      // Output should contain the original variable names
      expect(debugOutput).toMatchSnapshot();
    });
  });
});
