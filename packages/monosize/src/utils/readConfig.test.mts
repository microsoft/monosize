import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { workspaceRoot } from 'nx/src/devkit-exports';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { readConfig, resetConfigCache } from './readConfig.mjs';
import type { MonoSizeConfig } from '../types.mjs';

vitest.mock('../output.mjs', () => ({
  log: {
    error: vitest.fn(),
  },
}));

async function setup(config: Partial<MonoSizeConfig>) {
  // Heads up!
  // GH actions has a weird naming of the temp directory that breaks path resolution:
  // "C:\Users\RUNNER~1\AppData" gets transformed to "file:///C:/Users/RUNNER%7E1/AppData"
  const tmpDir = path.join(workspaceRoot, 'node_modules', '.tmp');
  await fs.promises.mkdir(tmpDir, { recursive: true });

  const packageDir = tmp.dirSync({ prefix: 'test-package', unsafeCleanup: true, tmpdir: tmpDir });
  const configFile = tmp.fileSync({ dir: packageDir.name, name: 'monosize.config.js', tmpdir: tmpDir });

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir.name);

  await fs.promises.writeFile(configFile.name, `export default ${JSON.stringify(config)}`);
}

describe('readConfig', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';

    vitest.resetAllMocks();
    vitest.resetModules();

    resetConfigCache();
  });

  it('should read config from package', async () => {
    await setup({ repository: '@microsoft/monosize' });

    expect(await readConfig(true)).toMatchObject({
      repository: '@microsoft/monosize',
    });
  });

  it('should return default webpack config if no config file defined', async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vitest.spyOn(console, 'log').mockImplementation(() => {});

    const exit = vitest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('TEST-MOCK: process.exit() was called');
    });
    const spy = vitest.spyOn(process, 'cwd');

    spy.mockReturnValue(os.tmpdir());

    await expect(readConfig(true)).rejects.toThrow('TEST-MOCK: process.exit() was called');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('should cache config', async () => {
    process.env.NODE_ENV = 'production';

    await setup({ repository: '@microsoft/monosize' });
    const firstConfig = await readConfig(true);

    await setup({ repository: '@microsoft/fluentui' });
    const secondConfig = await readConfig();

    expect(firstConfig).toBe(secondConfig);
    expect(secondConfig).toMatchObject({
      repository: '@microsoft/monosize',
    });
  });
});
