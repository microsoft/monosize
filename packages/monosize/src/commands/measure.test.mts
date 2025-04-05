import fs from 'node:fs';
import path from 'node:path';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';
import api, { type MeasureOptions } from './measure.mjs';
import { logger } from '../logger.mjs';

const buildFixture = vitest.hoisted(() =>
  vitest.fn().mockImplementation(async ({ fixturePath }) => {
    const outputPath = path.resolve(
      path.dirname(fixturePath),
      path.basename(fixturePath).replace('.fixture.js', '.output.js'),
    );

    fs.cpSync(fixturePath, outputPath);

    return { outputPath };
  }),
);

vitest.mock('../utils/readConfig.mts', () => ({
  readConfig: vitest.fn().mockResolvedValue({
    bundler: { buildFixture },
  }),
}));

async function setup(fixtures: { [key: string]: string }) {
  const packageDir = tmp.dirSync({ unsafeCleanup: true });

  const cwd = vitest.spyOn(process, 'cwd');
  cwd.mockReturnValue(packageDir.name);

  const fixturesDir = path.resolve(packageDir.name, 'bundle-size');
  fs.mkdirSync(fixturesDir);

  for (const [fixture, content] of Object.entries(fixtures)) {
    fs.writeFileSync(path.resolve(fixturesDir, fixture), content);
  }

  return {
    packageDir: packageDir.name,
  };
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

describe('measure', () => {
  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it('builds fixtures and created a report', async () => {
    const { packageDir } = await setup(getMockedFixtures('foo', 'bar'));
    const options: MeasureOptions = {
      quiet: true,
      debug: false,
      'artifacts-location': 'output',
      fixtures: '*.fixture.js',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    // Fixtures

    expect(fs.readdirSync(path.resolve(packageDir, 'output'))).toEqual([
      'bar.fixture.js',
      'bar.output.js',
      'foo.fixture.js',
      'foo.output.js',
      'monosize.json',
    ]);

    // Report

    const report = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'output', 'monosize.json'), 'utf-8'));

    expect(report).toEqual([
      {
        name: 'bar',
        path: 'bundle-size/bar.fixture.js',
        minifiedSize: expect.any(Number),
        gzippedSize: expect.any(Number),
      },
      {
        name: 'foo',
        path: 'bundle-size/foo.fixture.js',
        minifiedSize: expect.any(Number),
        gzippedSize: expect.any(Number),
      },
    ]);
  });

  it('builds single targeted fixture when full filename passed', async () => {
    const { packageDir } = await setup(getMockedFixtures('foo', 'bar', 'baz'));
    const options: MeasureOptions = {
      quiet: true,
      debug: false,
      'artifacts-location': 'output',
      fixtures: 'foo.fixture.js',
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    // Fixtures

    expect(fs.readdirSync(path.resolve(packageDir, 'output'))).toEqual([
      'foo.fixture.js',
      'foo.output.js',
      'monosize.json',
    ]);
  });

  it('builds only targeted fixtures with pattern passed', async () => {
    const { packageDir } = await setup(getMockedFixtures('foo', 'bar', 'baz'));
    const options: MeasureOptions = { quiet: true, debug: false, 'artifacts-location': 'output', fixtures: 'ba*' };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    // Fixtures

    expect(fs.readdirSync(path.resolve(packageDir, 'output'))).toEqual([
      'bar.fixture.js',
      'bar.output.js',
      'baz.fixture.js',
      'baz.output.js',
      'monosize.json',
    ]);
  });

  it('returns exit code of 1 and displays message when fixtures argument fails to match any fixture filename', async () => {
    const errorLog = vitest.spyOn(logger, 'error').mockImplementation(noop);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockExit = vitest.spyOn(process, 'exit').mockImplementation(noop as any);

    await setup({});
    const options: MeasureOptions = {
      quiet: true,
      debug: false,
      'artifacts-location': 'output',
      fixtures: 'invalid-filename.js',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    expect(errorLog.mock.calls[0][0]).toMatch(/No matching fixtures found for globbing pattern 'invalid-filename.js'/);
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
