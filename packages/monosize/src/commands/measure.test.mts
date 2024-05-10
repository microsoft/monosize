import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import api, { type MeasureOptions } from './measure.mjs';

const buildFixture = vitest.hoisted(() =>
  vitest.fn().mockImplementation(async ({ fixturePath }) => {
    const outputPath = path.resolve(
      path.dirname(fixturePath),
      path.basename(fixturePath).replace('.fixture.js', '.output.js'),
    );
    await fs.cp(fixturePath, outputPath);

    return { outputPath };
  }),
);

vitest.mock('../utils/readConfig', () => ({
  readConfig: vitest.fn().mockResolvedValue({
    bundler: { buildFixture },
  }),
}));

async function setup(fixtures: { [key: string]: string }) {
  const packageDir = tmp.dirSync({ unsafeCleanup: true });

  const cwd = vitest.spyOn(process, 'cwd');
  cwd.mockReturnValue(packageDir.name);

  const fixturesDir = path.resolve(packageDir.name, 'bundle-size');
  await fs.mkdir(fixturesDir);

  for (const [fixture, content] of Object.entries(fixtures)) {
    await fs.writeFile(path.resolve(fixturesDir, fixture), content);
  }

  return {
    packageDir: packageDir.name,
  };
}

describe('measure', () => {
  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it('builds fixtures and created a report', async () => {
    const { packageDir } = await setup({
      'foo.fixture.js': `
        console.log("foo");
        export default { name: 'foo' };
      `,
      'bar.fixture.js': `
        console.log("bar");
        export default { name: 'bar' };
      `,
    });
    const options: MeasureOptions = { quiet: true, debug: false, 'artifacts-location': 'output' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    // Fixtures

    expect(await fs.readdir(path.resolve(packageDir, 'output'))).toEqual([
      'bar.fixture.js',
      'bar.output.js',
      'foo.fixture.js',
      'foo.output.js',
      'monosize.json',
    ]);

    // Report

    const report = JSON.parse(await fs.readFile(path.resolve(process.cwd(), 'output', 'monosize.json'), 'utf-8'));

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
});
