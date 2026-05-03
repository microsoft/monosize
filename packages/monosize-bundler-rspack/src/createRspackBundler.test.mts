import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import prettier from 'prettier';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createEnvironmentConfig, createRspackBundler } from './createRspackBundler.mjs';

async function setup(content: string): Promise<string> {
  const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildFixture'));

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir);

  const fixtureDir = path.join(packageDir, 'monosize');
  fs.mkdirSync(fixtureDir, { recursive: true });

  const fixtureFilePath = path.join(fixtureDir, 'test.fixture.js');

  await fs.promises.writeFile(fixtureFilePath, content);

  return fixtureFilePath;
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
        outputDir: '/workspace/dist/my-fixture.output',
      }),
    ).toMatchInlineSnapshot(`
      {
        "default": {
          "output": {
            "distPath": {
              "js": "./",
              "root": "/workspace/dist/my-fixture.output",
            },
            "emitAssets": false,
            "externals": {
              "react": "React",
              "react-dom": "ReactDOM",
            },
            "filename": {
              "js": "index.js",
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
    const output = await prepareOutput(path.join(result.outputDir, 'index.js'));

    expect(result.outputDir).toMatch(/monosize[\\|/]dist[\\|/]test\.output$/);
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
      const output = await prepareOutput(path.join(buildResult.outputDir, 'index.js'));

      expect(buildResult.outputDir).toMatch(/monosize[\\|/]dist[\\|/]test\.output$/);
      expect(buildResult.debugOutputDir).toBeUndefined();

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

      expect(buildResult.outputDir).toMatch(/monosize[\\|/]dist[\\|/]test\.output$/);
      expect(buildResult.debugOutputDir).toMatch(/monosize[\\|/]dist[\\|/]test\.debug$/);

      const output = await prepareOutput(path.join(buildResult.outputDir, 'index.js'));
      const debugOutput = await prepareOutput(path.join(buildResult.debugOutputDir as string, 'index.js'));

      expect(output).toMatchSnapshot();
      // Output should contain the original variable names
      expect(debugOutput).toMatchSnapshot();
    });
  });
});

async function setupMultiple(
  fixtures: Array<{ name: string; content: string }>,
): Promise<{ dir: string; fixtures: Array<{ name: string; path: string }> }> {
  const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buildFixtures'));

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir);

  const fixtureDir = path.join(packageDir, 'monosize');
  fs.mkdirSync(fixtureDir, { recursive: true });

  const fixtureResults = await Promise.all(
    fixtures.map(async ({ name, content }) => {
      const fixturePath = path.join(fixtureDir, `${name}.fixture.js`);
      await fs.promises.writeFile(fixturePath, content);
      return { name, path: fixturePath };
    }),
  );

  return { dir: fixtureDir, fixtures: fixtureResults };
}

describe('buildFixtures', () => {
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

  it('builds fixtures in batch mode', async () => {
    const { fixtures } = await setupMultiple([
      {
        name: 'fixture1',
        content: `
          const tokens1 = {
            foo: 'foo',
            bar: 'bar',
          };
          function foo1 () { return tokens1.foo; }
          const bar1 = 1;

          console.log(foo1);
        `,
      },
      {
        name: 'fixture2',
        content: `
          const hello2 = 'Hello2';
          const world2 = 'world2';

          console.log(hello2);
        `,
      },
      {
        name: 'fixture3',
        content: `
          const hello3 = 'Hello3';
          const world3 = 'world3';

          console.log(hello3);
        `,
      },
    ]);

    const buildResults = await rspackBundler.buildFixtures({
      fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: false,
      quiet: true,
    });

    expect(buildResults).toHaveLength(3);

    // Check that all files were created
    expect(buildResults[0].name).toBe('fixture1');
    expect(buildResults[0].outputDir).toMatch(/monosize[\\|/]dist[\\|/]fixture1\.output$/);
    expect(await prepareOutput(path.join(buildResults[0].outputDir, 'index.js'))).toMatchSnapshot();

    expect(buildResults[1].name).toBe('fixture2');
    expect(buildResults[1].outputDir).toMatch(/monosize[\\|/]dist[\\|/]fixture2\.output$/);
    expect(await prepareOutput(path.join(buildResults[1].outputDir, 'index.js'))).toMatchSnapshot();

    expect(buildResults[2].name).toBe('fixture3');
    expect(buildResults[2].outputDir).toMatch(/monosize[\\|/]dist[\\|/]fixture3\.output$/);
    expect(await prepareOutput(path.join(buildResults[2].outputDir, 'index.js'))).toMatchSnapshot();
  });

  it('builds fixtures in batch mode with debug', async () => {
    const { fixtures } = await setupMultiple([
      {
        name: 'fixture1',
        content: `
        const tokens1 = {
          foo: 'foo',
          bar: 'bar',
        };
        function foo1 () { return tokens1.foo; }
        const bar1 = 1;

        console.log(foo1);
      `,
      },
      {
        name: 'fixture2',
        content: `
        const tokens2 = {
          foo: 'foo',
          bar: 'bar',
        };
        function foo2 () { return tokens2.foo; }
        const bar2 = 1;

        console.log(foo2);
      `,
      },
    ]);

    const buildResults = await rspackBundler.buildFixtures({
      fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: true,
      quiet: true,
    });

    expect(buildResults).toHaveLength(2);

    // Check that debug dirs were created
    expect(buildResults[0].debugOutputDir).toMatch(/monosize[\\|/]dist[\\|/]fixture1\.debug$/);
    expect(buildResults[1].debugOutputDir).toMatch(/monosize[\\|/]dist[\\|/]fixture2\.debug$/);

    // Verify debug files exist and contain the expected content
    const debugOutput1 = await prepareOutput(path.join(buildResults[0].debugOutputDir!, 'index.js'));
    const debugOutput2 = await prepareOutput(path.join(buildResults[1].debugOutputDir!, 'index.js'));

    expect(debugOutput1).toMatchSnapshot();
    expect(debugOutput2).toMatchSnapshot();
  });

  it('should throw on compilation errors in any fixture', async () => {
    const { fixtures } = await setupMultiple([
      {
        name: 'fixture1',
        content: `console.log('valid');`,
      },
      {
        name: 'fixture2',
        content: `console..log(hello);`,
      },
    ]);

    await expect(
      rspackBundler.buildFixtures({
        fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
        debug: false,
        quiet: true,
      }),
    ).rejects.toMatchInlineSnapshot(`[Error: Rspack build failed.]`);
  });

  it('produces identical output whether using buildFixture or buildFixtures', async () => {
    // Create test fixtures with realistic content that produces output (side effects prevent tree-shaking)
    const fixtureContents = [
      {
        name: 'component1',
        content: `
          const Component1 = {
            name: 'Component1',
            value: 42,
            render: function() {
              return 'Hello from Component1: ' + this.value;
            }
          };
          console.log(Component1.render());
        `,
      },
      {
        name: 'component2',
        content: `
          const Component2 = {
            name: 'Component2',
            data: [1, 2, 3, 4, 5],
            process: function() {
              return this.data.map(x => x * 2);
            }
          };
          console.log(Component2.process());
        `,
      },
      {
        name: 'component3',
        content: `
          const Component3 = {
            name: 'Component3',
            greeting: 'World',
            getMessage: function() {
              return 'Hello, ' + this.greeting + '!';
            }
          };
          console.log(Component3.getMessage());
        `,
      },
    ];

    // Build using loop mode (buildFixture for each)
    const { fixtures: loopFixtures } = await setupMultiple(fixtureContents);
    const loopOutputs = await Promise.all(
      loopFixtures.map(async fixture => {
        const result = await rspackBundler.buildFixture({
          fixturePath: fixture.path,
          debug: false,
          quiet: true,
        });
        const content = await prepareOutput(path.join(result.outputDir, 'index.js'));
        return { name: fixture.name, content };
      }),
    );

    // Build using batch mode (buildFixtures)
    const { fixtures: batchFixtures } = await setupMultiple(fixtureContents);
    const batchResults = await rspackBundler.buildFixtures({
      fixtures: batchFixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: false,
      quiet: true,
    });

    const batchOutputs = await Promise.all(
      batchResults.map(async result => ({
        name: result.name,
        content: await prepareOutput(path.join(result.outputDir, 'index.js')),
      })),
    );

    // Sort both arrays by name to ensure consistent ordering
    loopOutputs.sort((a, b) => a.name.localeCompare(b.name));
    batchOutputs.sort((a, b) => a.name.localeCompare(b.name));

    // Validate outputs are identical
    expect(batchOutputs).toEqual(loopOutputs);
  });
});
