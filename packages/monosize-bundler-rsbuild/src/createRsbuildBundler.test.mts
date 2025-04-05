import fs from 'node:fs';
import path from 'node:path';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createRsbuildBundler } from './createRsbuildBundler.mjs';

async function setup(
  fixtures: { content: string; name: string }[],
): Promise<{ fixtureDir: string; fixtureFiles: string[] }> {
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
  const fixtureFiles: string[] = [];

  for (const fixture of fixtures) {
    const fixtureFile = tmp.fileSync({
      dir: fixtureDir.name,
      name: `${fixture.name}.fixture.js`,
    });

    await fs.promises.writeFile(fixtureFile.name, fixture.content);
    fixtureFiles.push(fixtureFile.name);
  }

  return {
    fixtureDir: fixtureDir.name,
    fixtureFiles,
  };
}

const rsbuildBundler = createRsbuildBundler();

describe('buildFixture', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures', async () => {
    const { fixtureFiles } = await setup([
      {
        content: `
      const hello = 'Hello';
      const world = 'world';

      console.log(hello);
    `,
        name: 'test',
      },
    ]);
    const buildResult = await rsbuildBundler.buildFixture({
      debug: false,
      fixturePath: fixtureFiles[0],
      quiet: true,
    });

    expect(buildResult.outputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.output\.js/);
    expect(await fs.promises.readFile(buildResult.outputPath, 'utf-8')).toMatchInlineSnapshot(
      `"(()=>{var r={},o={};function e(t){var n=o[t];if(void 0!==n)return n.exports;var s=o[t]={exports:{}};return r[t](s,s.exports,e),s.exports}e.rv=()=>"1.3.2",e.ruid="bundler=rspack@1.3.2",console.log("Hello")})();"`,
    );
  });

  it('should throw on compilation errors', async () => {
    const { fixtureFiles } = await setup([
      {
        content: `import something from 'unknown-pkg'`,
        name: 'test',
      },
    ]);

    await expect(
      rsbuildBundler.buildFixture({
        debug: false,
        fixturePath: fixtureFiles[0],
        quiet: true,
      }),
    ).rejects.toMatchInlineSnapshot(`[Error: Rspack build failed.]`);
  });

  describe('debug mode', () => {
    it('does not output additional files when disabled', async () => {
      const { fixtureFiles } = await setup([
        {
          content: `
      const tokens = {
        foo: 'foo',
        bar: 'bar',
      };
      function foo () { return tokens.foo; }
      const bar = 1;
      console.log(foo);
    `,
          name: 'test',
        },
      ]);
      const buildResult = await rsbuildBundler.buildFixture({
        debug: false,
        fixturePath: fixtureFiles[0],
        quiet: true,
      });
      const output = await fs.promises.readFile(buildResult.outputPath, 'utf-8');

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toBeUndefined();

      expect(output).toMatchInlineSnapshot(
        `"(()=>{var r={},o={};function e(t){var n=o[t];if(void 0!==n)return n.exports;var u=o[t]={exports:{}};return r[t](u,u.exports,e),u.exports}e.rv=()=>"1.3.2",e.ruid="bundler=rspack@1.3.2";let t={foo:"foo"};console.log(function(){return t.foo})})();"`,
      );
    });

    it('provides partially minified output when enabled', async () => {
      const { fixtureFiles } = await setup([
        {
          content: `
      const tokens = {
        foo: 'foo',
        bar: 'bar',
      };
      function foo () { return tokens.foo; }
      const bar = 1;
      console.log(foo);
    `,
          name: 'test',
        },
      ]);
      const buildResult = await rsbuildBundler.buildFixture({
        debug: true,
        fixturePath: fixtureFiles[0],
        quiet: true,
      });

      expect(buildResult.outputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.output\.js/);
      expect(buildResult.debugOutputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.debug\.js/);

      const output = await fs.promises.readFile(buildResult.outputPath, 'utf-8');
      const debugOutput = await fs.promises.readFile(buildResult.debugOutputPath!, 'utf-8');

      expect(output).toMatchInlineSnapshot(
        `"(()=>{var r={},o={};function e(t){var n=o[t];if(void 0!==n)return n.exports;var u=o[t]={exports:{}};return r[t](u,u.exports,e),u.exports}e.rv=()=>"1.3.2",e.ruid="bundler=rspack@1.3.2";let t={foo:"foo"};console.log(function(){return t.foo})})();"`,
      );

      // Output should contain the original variable names
      expect(debugOutput).toMatchInlineSnapshot(`
        "(() => { // webpackBootstrap
        var __webpack_modules__ = ({});
        /************************************************************************/
        // The module cache
        var __webpack_module_cache__ = {};

        // The require function
        function __webpack_require__(moduleId) {

        // Check if module is in cache
        var cachedModule = __webpack_module_cache__[moduleId];
        if (cachedModule !== undefined) {
        return cachedModule.exports;
        }
        // Create a new module (and put it into the cache)
        var module = (__webpack_module_cache__[moduleId] = {
        exports: {}
        });
        // Execute the module function
        __webpack_modules__[moduleId](module, module.exports, __webpack_require__);

        // Return the exports of the module
        return module.exports;

        }

        /************************************************************************/
        // webpack/runtime/rspack_version
        (() => {
        __webpack_require__.rv = () => ("1.3.2")
        })();
        // webpack/runtime/rspack_unique_id
        (() => {
        __webpack_require__.ruid = "bundler=rspack@1.3.2";

        })();
        /************************************************************************/

              const tokens = {
                foo: 'foo',
                bar: 'bar',
              };
              function foo () { return tokens.foo; }
              const bar = 1;
              console.log(foo);
            
        })()
        ;"
      `);
    });
  });
});

describe('buildFixtures', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures', async () => {
    const { fixtureDir, fixtureFiles } = await setup([
      { content: `console.log('Hello');`, name: 'testA' },
      { content: `console.log('world!');`, name: 'testB' },
    ]);
    const buildResult = await rsbuildBundler.buildFixtures!({
      debug: false,
      fixturePaths: fixtureFiles,
      rootDir: fixtureDir,
      quiet: true,
    });

    expect(buildResult).toHaveLength(2);

    expect(buildResult[0].outputPath).toMatch(/[\\|/]dist[\\|/]testA[\\|/]testA\.output\.js/);
    expect(fs.readFileSync(buildResult[0].outputPath, 'utf-8')).toMatchInlineSnapshot(
      `"(()=>{var r={},o={};function e(t){var n=o[t];if(void 0!==n)return n.exports;var s=o[t]={exports:{}};return r[t](s,s.exports,e),s.exports}e.rv=()=>"1.3.2",e.ruid="bundler=rspack@1.3.2",console.log("Hello")})();"`,
    );

    expect(buildResult[1].outputPath).toMatch(/[\\|/]dist[\\|/]testB[\\|/]testB\.output\.js/);
    expect(fs.readFileSync(buildResult[1].outputPath, 'utf-8')).toMatchInlineSnapshot(
      `"(()=>{var r={},o={};function e(t){var n=o[t];if(void 0!==n)return n.exports;var s=o[t]={exports:{}};return r[t](s,s.exports,e),s.exports}e.rv=()=>"1.3.2",e.ruid="bundler=rspack@1.3.2",console.log("world!")})();"`,
    );
  });
});
