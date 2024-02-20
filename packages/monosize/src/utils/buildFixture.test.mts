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
    name: 'test-fixture.js',
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
  webpack: config => config,
};

describe('buildFixture', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('builds fixtures and returns minified & GZIP sizes', async () => {
    const fixturePath = await setup(`console.log('Hello world')`);
    const buildResult = await buildFixture(fixturePath, config, true);

    expect(buildResult.name).toBe('Test fixture');
    expect(buildResult.path).toMatch(/monosize[\\|/]test-fixture.js/);

    expect(buildResult.minifiedSize).toBeGreaterThan(1);
    expect(buildResult.gzippedSize).toBeGreaterThan(1);
  });

  it('should throw on compilation errors', async () => {
    const fixturePath = await setup(`import something from 'unknown-pkg'`);
    await expect(buildFixture(fixturePath, config, true)).rejects.toBeDefined();
  });
});
