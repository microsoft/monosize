import fs from 'node:fs';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createRsbuildBundler } from './createRsbuildBundler.mjs';

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

const rsbuildBundler = createRsbuildBundler();

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
    const buildResult = await rsbuildBundler.buildFixture({
      debug: false,
      fixturePath,
      quiet: true,
    });

    expect(buildResult.outputPath).toMatch(/monosize[\\|/]dist[\\|/]test\.output\.js/);
    expect(await fs.promises.readFile(buildResult.outputPath, 'utf-8')).toMatchInlineSnapshot(
      `"(()=>{var r={},o={};function e(t){var n=o[t];if(void 0!==n)return n.exports;var s=o[t]={exports:{}};return r[t](s,s.exports,e),s.exports}e.rv=()=>"1.3.2",e.ruid="bundler=rspack@1.3.2",console.log("Hello")})();"`,
    );
  });

  it('should throw on compilation errors', async () => {
    const fixturePath = await setup(`import something from 'unknown-pkg'`);

    await expect(
      rsbuildBundler.buildFixture({
        debug: false,
        fixturePath,
        quiet: true,
      }),
    ).rejects.toMatchInlineSnapshot(`[Error: Rspack build failed.]`);
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
      const buildResult = await rsbuildBundler.buildFixture({
        debug: false,
        fixturePath,
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
      const fixturePath = await setup(`
      const tokens = {
        foo: 'foo',
        bar: 'bar',
      };
      function foo () { return tokens.foo; }
      const bar = 1;
      console.log(foo);
    `);
      const buildResult = await rsbuildBundler.buildFixture({
        debug: true,
        fixturePath,
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
