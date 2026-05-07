import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, vitest } from 'vitest';
import api, { type MeasureOptions } from './measure.mjs';
import { logger } from '../logger.mjs';

/**
 * Materializes an `outputDir` next to the prepared fixture and writes the
 * given files into it. Mirrors what a real bundler would do.
 */
function writeOutputDir(fixturePath: string, files: Record<string, string | Buffer>): string {
  const outputDir = fixturePath.replace(/\.fixture\.js$/, '.output');
  fs.mkdirSync(outputDir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(outputDir, filename), content);
  }
  return outputDir;
}

const buildFixtures = vitest.hoisted(() => vitest.fn());

vitest.mock('../utils/readConfig.mts', () => ({
  readConfig: vitest.fn().mockResolvedValue({
    bundler: { name: 'fake', buildFixtures },
    assetTypes: ['css', 'js', 'json'],
  }),
}));

// Default: copy the fixture's source to <outputDir>/index.js. Tests that
// need a specific file set call `buildFixtures.mockImplementationOnce(...)`.
buildFixtures.mockImplementation(async ({ fixtures }: { fixtures: Array<{ fixturePath: string; name: string }> }) =>
  fixtures.map(({ fixturePath, name }) => ({
    name,
    outputDir: writeOutputDir(fixturePath, { 'index.js': fs.readFileSync(fixturePath) }),
  })),
);

async function setup(fixtures: { [key: string]: string }) {
  const packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'measure'));

  const cwd = vitest.spyOn(process, 'cwd');
  cwd.mockReturnValue(packageDir);

  const fixturesDir = path.resolve(packageDir, 'bundle-size');
  fs.mkdirSync(fixturesDir);

  for (const [fixture, content] of Object.entries(fixtures)) {
    fs.writeFileSync(path.resolve(fixturesDir, fixture), content);
  }

  return { packageDir };
}

const getMockedFixtures = (...fixtureNames: string[]) =>
  fixtureNames.reduce(
    (acc, item) => ({
      ...acc,
      [`${item}.fixture.js`]: `
      console.log("${item}");
      export default { name: '${item}' };
    `,
    }),
    {},
  );

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

const baseOptions = (overrides: Partial<MeasureOptions> = {}): MeasureOptions => ({
  quiet: true,
  debug: false,
  'artifacts-location': 'output',
  fixtures: '*.fixture.js',
  ...overrides,
});

describe('measure', () => {
  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it('builds fixtures and creates a report', async () => {
    const { packageDir } = await setup(getMockedFixtures('foo', 'bar'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(baseOptions() as any);

    // Each fixture has its own `<name>.output/` subdirectory containing index.js.
    expect(fs.readdirSync(path.resolve(packageDir, 'output'))).toEqual([
      'bar.fixture.js',
      'bar.output',
      'foo.fixture.js',
      'foo.output',
      'monosize.json',
    ]);

    const report = JSON.parse(fs.readFileSync(path.resolve(packageDir, 'output', 'monosize.json'), 'utf-8'));
    expect(report).toEqual([
      {
        name: 'bar',
        path: 'bundle-size/bar.fixture.js',
        minifiedSize: expect.any(Number),
        gzippedSize: expect.any(Number),
        assets: { js: { minifiedSize: expect.any(Number), gzippedSize: expect.any(Number) } },
      },
      {
        name: 'foo',
        path: 'bundle-size/foo.fixture.js',
        minifiedSize: expect.any(Number),
        gzippedSize: expect.any(Number),
        assets: { js: { minifiedSize: expect.any(Number), gzippedSize: expect.any(Number) } },
      },
    ]);
    // Top-level totals equal the sum of breakdown entries.
    for (const entry of report) {
      const sum = (Object.values(entry.assets) as Array<{ minifiedSize: number; gzippedSize: number }>).reduce(
        (acc, a) => ({ minifiedSize: acc.minifiedSize + a.minifiedSize, gzippedSize: acc.gzippedSize + a.gzippedSize }),
        { minifiedSize: 0, gzippedSize: 0 },
      );
      expect(entry.minifiedSize).toBe(sum.minifiedSize);
      expect(entry.gzippedSize).toBe(sum.gzippedSize);
    }
  });

  it('builds single targeted fixture when full filename passed', async () => {
    const { packageDir } = await setup(getMockedFixtures('foo', 'bar', 'baz'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(baseOptions({ fixtures: 'foo.fixture.js' }) as any);

    expect(fs.readdirSync(path.resolve(packageDir, 'output'))).toEqual([
      'foo.fixture.js',
      'foo.output',
      'monosize.json',
    ]);
  });

  it('builds only targeted fixtures with pattern passed', async () => {
    const { packageDir } = await setup(getMockedFixtures('foo', 'bar', 'baz'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(baseOptions({ fixtures: 'ba*' }) as any);

    expect(fs.readdirSync(path.resolve(packageDir, 'output'))).toEqual([
      'bar.fixture.js',
      'bar.output',
      'baz.fixture.js',
      'baz.output',
      'monosize.json',
    ]);
  });

  it('returns exit code of 1 and displays message when fixtures argument fails to match any fixture filename', async () => {
    const errorLog = vitest.spyOn(logger, 'error').mockImplementation(noop);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockExit = vitest.spyOn(process, 'exit').mockImplementation(noop as any);

    await setup({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(baseOptions({ fixtures: 'invalid-filename.js' }) as any);

    expect(errorLog.mock.calls[0][0]).toMatch(/No matching fixtures found for globbing pattern 'invalid-filename.js'/);
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  describe('multi-asset behavior', () => {
    /** Override the synthetic adapter for one call with a controlled file set. */
    function withAdapterFiles(files: Record<string, string | Buffer>) {
      buildFixtures.mockImplementationOnce(async ({ fixtures }: { fixtures: Array<{ fixturePath: string; name: string }> }) =>
        fixtures.map(({ fixturePath, name }) => ({
          name,
          outputDir: writeOutputDir(fixturePath, files),
        })),
      );
    }

    it('classifies files by extension and sums per type', async () => {
      withAdapterFiles({
        'index.js': 'a'.repeat(100),
        'index.css': 'b'.repeat(50),
      });
      const { packageDir } = await setup(getMockedFixtures('foo'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.handler(baseOptions() as any);

      const report = JSON.parse(fs.readFileSync(path.resolve(packageDir, 'output', 'monosize.json'), 'utf-8'));
      const entry = report[0];
      expect(entry.assets.js.minifiedSize).toBe(100);
      expect(entry.assets.css.minifiedSize).toBe(50);
      expect(entry.minifiedSize).toBe(150);
    });

    it('skips files outside the allowlist', async () => {
      withAdapterFiles({
        'index.js': 'js-content',
        'index.js.map': 'sourcemap-content',
        'LICENSE.txt': 'license-content',
      });
      const { packageDir } = await setup(getMockedFixtures('foo'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.handler(baseOptions() as any);

      const report = JSON.parse(fs.readFileSync(path.resolve(packageDir, 'output', 'monosize.json'), 'utf-8'));
      const entry = report[0];
      expect(Object.keys(entry.assets)).toEqual(['js']);
    });

    it('produces empty assets {} and warns when no allowlisted files emitted', async () => {
      const warn = vitest.spyOn(logger, 'warn').mockImplementation(noop);
      withAdapterFiles({ 'index.svg': '<svg/>' });
      const { packageDir } = await setup(getMockedFixtures('foo'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.handler(baseOptions() as any);

      const report = JSON.parse(fs.readFileSync(path.resolve(packageDir, 'output', 'monosize.json'), 'utf-8'));
      const entry = report[0];
      expect(entry.assets).toEqual({});
      expect(entry.minifiedSize).toBe(0);
      expect(entry.gzippedSize).toBe(0);
      expect(warn).toHaveBeenCalled();
    });

    it('sums per-file gzipped sizes when a type has multiple files', async () => {
      withAdapterFiles({
        'b.js': 'B',
        'a.js': 'A',
      });
      const { packageDir } = await setup(getMockedFixtures('foo'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.handler(baseOptions() as any);

      const report = JSON.parse(fs.readFileSync(path.resolve(packageDir, 'output', 'monosize.json'), 'utf-8'));
      const entry = report[0];
      // Each file is gzipped independently and the lengths are summed; the
      // result is order-independent (commutative addition).
      const expected = gzipSync(Buffer.from('A')).length + gzipSync(Buffer.from('B')).length;
      expect(entry.assets.js.gzippedSize).toBe(expected);
      expect(entry.assets.js.minifiedSize).toBe(2);
    });

    it('extension match is case-insensitive; canonical key is lowercase', async () => {
      withAdapterFiles({
        'INDEX.JS': 'js-content',
        'index.JSON': '{}',
      });
      const { packageDir } = await setup(getMockedFixtures('foo'));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await api.handler(baseOptions() as any);

      const report = JSON.parse(fs.readFileSync(path.resolve(packageDir, 'output', 'monosize.json'), 'utf-8'));
      const entry = report[0];
      expect(Object.keys(entry.assets).sort()).toEqual(['js', 'json']);
    });
  });
});
