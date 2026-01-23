import fs from 'node:fs/promises';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createEsbuildBundler } from './createEsbuildBundler.mjs';

async function setup(fixtureContent: string): Promise<string> {
  const { fixtures } = await setupMultiple([{ name: 'test', content: fixtureContent }]);
  return fixtures[0].path;
}

async function setupMultiple(
  fixtures: Array<{ name: string; content: string }>,
): Promise<{ dir: string; fixtures: Array<{ name: string; path: string }> }> {
  const packageDir = tmp.dirSync({
    prefix: 'buildFixtures',
    unsafeCleanup: true,
  });

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir.name);

  const fixtureDir = tmp.dirSync({
    dir: packageDir.name,
    name: 'monosize',
    unsafeCleanup: true,
  });

  const fixtureResults = await Promise.all(
    fixtures.map(async ({ name, content }) => {
      const fixture = tmp.fileSync({
        dir: fixtureDir.name,
        name: `${name}.fixture.js`,
      });
      await fs.writeFile(fixture.name, content);
      const realPath = await fs.realpath(fixture.name);
      return { name, path: realPath };
    }),
  );

  return { dir: fixtureDir.name, fixtures: fixtureResults };
}

const esbuildBundler = createEsbuildBundler();

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
    const buildResult = await esbuildBundler.buildFixture({
      debug: false,
      fixturePath,
      quiet: true,
    });

    expect(buildResult.outputPath).toMatch(/monosize[\\|/]test\.output\.js/);
    expect(await fs.readFile(buildResult.outputPath, 'utf-8')).toMatchInlineSnapshot(`
      "(()=>{var o="Hello world";console.log(o);})();
      "
    `);
  });

  it('should throw on compilation errors', async () => {
    const fixturePath = await setup(`import something from 'unknown-pkg'`);

    await expect(
      esbuildBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      }),
    ).rejects.toThrow(/Could not resolve "unknown-pkg"/);
  });
});

describe('buildFixtures', () => {
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

    const buildResults = await esbuildBundler.buildFixtures!({
      fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: false,
      quiet: true,
    });

    expect(buildResults).toHaveLength(3);

    // Check that all files were created
    expect(buildResults[0].name).toBe('fixture1');
    expect(buildResults[0].outputPath).toMatch(/monosize[\\|/]fixture1\.output\.js/);
    expect(await fs.readFile(buildResults[0].outputPath, 'utf-8')).toMatchInlineSnapshot(`
      "(()=>{var o={foo:"foo",bar:"bar"};function n(){return o.foo}console.log(n);})();
      "
    `);

    expect(buildResults[1].name).toBe('fixture2');
    expect(buildResults[1].outputPath).toMatch(/monosize[\\|/]fixture2\.output\.js/);
    expect(await fs.readFile(buildResults[1].outputPath, 'utf-8')).toMatchInlineSnapshot(`
      "(()=>{var o="Hello2";console.log(o);})();
      "
    `);

    expect(buildResults[2].name).toBe('fixture3');
    expect(buildResults[2].outputPath).toMatch(/monosize[\\|/]fixture3\.output\.js/);
    expect(await fs.readFile(buildResults[2].outputPath, 'utf-8')).toMatchInlineSnapshot(`
      "(()=>{var o="Hello3";console.log(o);})();
      "
    `);
  });

  it('should throw on compilation errors in any fixture', async () => {
    const { fixtures } = await setupMultiple([
      {
        name: 'fixture1',
        content: `console.log('valid');`,
      },
      {
        name: 'fixture2',
        content: `import something from 'unknown-pkg';`,
      },
    ]);

    await expect(
      esbuildBundler.buildFixtures!({
        fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
        debug: false,
        quiet: true,
      }),
    ).rejects.toThrow();
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
        const result = await esbuildBundler.buildFixture({
          fixturePath: fixture.path,
          debug: false,
          quiet: true,
        });
        const content = await fs.readFile(result.outputPath, 'utf-8');
        return { name: fixture.name, content };
      }),
    );

    // Build using batch mode (buildFixtures)
    const { fixtures: batchFixtures } = await setupMultiple(fixtureContents);
    const batchResults = await esbuildBundler.buildFixtures!({
      fixtures: batchFixtures.map(f => ({ fixturePath: f.path, name: f.name })),
      debug: false,
      quiet: true,
    });

    const batchOutputs = await Promise.all(
      batchResults.map(async result => ({
        name: result.name,
        content: await fs.readFile(result.outputPath, 'utf-8'),
      })),
    );

    // Sort both arrays by name to ensure consistent ordering
    loopOutputs.sort((a, b) => a.name.localeCompare(b.name));
    batchOutputs.sort((a, b) => a.name.localeCompare(b.name));

    // Validate outputs are identical
    expect(batchOutputs).toEqual(loopOutputs);
  });
});
