import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import prettier from 'prettier';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createBaseConfig, createViteBundler } from './createViteBundler.mjs';

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

describe('createBaseConfig', () => {
  it('produces a config with iife lib output and react externals', () => {
    const config = createBaseConfig({
      root: '/workspace/fixtures',
      fixturePath: '/workspace/fixtures/my-fixture.js',
      outputPath: '/workspace/dist/my-fixture.js',
      minify: true,
    });

    expect(config.build?.outDir).toBe('/workspace/dist');
    expect(config.build?.lib).toMatchObject({
      entry: '/workspace/fixtures/my-fixture.js',
      formats: ['iife'],
    });
    expect(config.build?.minify).toBe(true);
    expect(config.build?.rollupOptions?.external).toEqual(['react', 'react-dom']);
  });

  it('disables minification for debug mode', () => {
    const config = createBaseConfig({
      root: '/workspace/fixtures',
      fixturePath: '/workspace/fixtures/my-fixture.js',
      outputPath: '/workspace/dist/my-fixture.debug.js',
      minify: false,
    });

    expect(config.build?.minify).toBe(false);
  });
});

describe('buildFixture', () => {
  const viteBundler = createViteBundler();

  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures', async () => {
    const fixturePath = await setup(`const hello = 'Hello'; console.log(hello);`);
    const result = await viteBundler.buildFixture({
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
      viteBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      }),
    ).rejects.toThrow();
  });

  describe('debug mode', () => {
    it('does not output additional files when disabled', async () => {
      const fixturePath = await setup(`
        const tokens = { foo: 'foo', bar: 'bar' };
        function foo () { return tokens.foo; }
        const bar = 1;
        console.log(foo);
      `);
      const buildResult = await viteBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      });

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toBeUndefined();

      const debugPath = buildResult.outputPath.replace(/\.output\.js$/, '.debug.js');
      expect(fs.existsSync(debugPath)).toBe(false);
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
      const buildResult = await viteBundler.buildFixture({
        debug: true,
        fixturePath,
        quiet: true,
      });

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.debug\.js/);

      expect(fs.existsSync(buildResult.outputPath)).toBe(true);
      expect(fs.existsSync(buildResult.debugOutputPath as string)).toBe(true);
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
  const viteBundler = createViteBundler();

  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures sequentially', async () => {
    const { fixtures } = await setupMultiple([
      {
        name: 'fixture1',
        content: `
          const tokens1 = { foo: 'foo', bar: 'bar' };
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

    const buildResults = await viteBundler.buildFixtures({
      fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: false,
      quiet: true,
    });

    expect(buildResults).toHaveLength(3);

    expect(buildResults[0].name).toBe('fixture1');
    expect(buildResults[0].outputPath).toMatch(/monosize[\\|/]dist[\\|/]fixture1\.output\.js/);
    expect(fs.existsSync(buildResults[0].outputPath)).toBe(true);

    expect(buildResults[1].name).toBe('fixture2');
    expect(buildResults[1].outputPath).toMatch(/monosize[\\|/]dist[\\|/]fixture2\.output\.js/);
    expect(fs.existsSync(buildResults[1].outputPath)).toBe(true);

    expect(buildResults[2].name).toBe('fixture3');
    expect(buildResults[2].outputPath).toMatch(/monosize[\\|/]dist[\\|/]fixture3\.output\.js/);
    expect(fs.existsSync(buildResults[2].outputPath)).toBe(true);
  });

  it('builds fixtures sequentially with debug', async () => {
    const { fixtures } = await setupMultiple([
      {
        name: 'fixture1',
        content: `
          const tokens1 = { foo: 'foo', bar: 'bar' };
          function foo1 () { return tokens1.foo; }
          console.log(foo1);
        `,
      },
      {
        name: 'fixture2',
        content: `
          const tokens2 = { foo: 'foo', bar: 'bar' };
          function foo2 () { return tokens2.foo; }
          console.log(foo2);
        `,
      },
    ]);

    const buildResults = await viteBundler.buildFixtures({
      fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: true,
      quiet: true,
    });

    expect(buildResults).toHaveLength(2);

    expect(buildResults[0].debugOutputPath).toMatch(/monosize[\\|/]dist[\\|/]fixture1\.debug\.js/);
    expect(buildResults[1].debugOutputPath).toMatch(/monosize[\\|/]dist[\\|/]fixture2\.debug\.js/);

    expect(fs.existsSync(buildResults[0].debugOutputPath as string)).toBe(true);
    expect(fs.existsSync(buildResults[1].debugOutputPath as string)).toBe(true);
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
      viteBundler.buildFixtures({
        fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
        debug: false,
        quiet: true,
      }),
    ).rejects.toThrow();
  });

  it('produces identical output whether using buildFixture or buildFixtures', async () => {
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

    const { fixtures: loopFixtures } = await setupMultiple(fixtureContents);
    const loopOutputs = await Promise.all(
      loopFixtures.map(async fixture => {
        const result = await viteBundler.buildFixture({
          fixturePath: fixture.path,
          debug: false,
          quiet: true,
        });
        const content = await prepareOutput(result.outputPath);
        return { name: fixture.name, content };
      }),
    );

    const { fixtures: batchFixtures } = await setupMultiple(fixtureContents);
    const batchResults = await viteBundler.buildFixtures({
      fixtures: batchFixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: false,
      quiet: true,
    });

    const batchOutputs = await Promise.all(
      batchResults.map(async result => ({
        name: result.name,
        content: await prepareOutput(result.outputPath),
      })),
    );

    loopOutputs.sort((a, b) => a.name.localeCompare(b.name));
    batchOutputs.sort((a, b) => a.name.localeCompare(b.name));

    expect(batchOutputs).toEqual(loopOutputs);
  });
});
