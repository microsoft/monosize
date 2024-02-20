import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import tmp from 'tmp';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { readConfig, resetConfigCache } from './readConfig.mjs';

async function setup(configContent: string): Promise<string> {
  const packageDir = tmp.dirSync({ prefix: 'test-package', unsafeCleanup: true });
  const config = tmp.fileSync({ dir: packageDir.name, name: 'monosize.config.js' });

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir.name);

  await fs.promises.writeFile(config.name, configContent);

  return path.relative(packageDir.name, config.name);
}

describe('readConfig', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';

    vitest.resetAllMocks();
    vitest.resetModules();

    resetConfigCache();
  });

  it('should read config from package', async () => {
    await setup(`export default { webpack: (config) => { config.foo = 'bar'; return config; } }`);

    const config = await readConfig(true);

    expect(config.webpack?.({})).toEqual({ foo: 'bar' });
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

    await setup(`export default { webpack: (config) => config }`);
    const firstConfig = await readConfig(true);

    await setup(`export default { webpack: (config) => { config.foo = 'bar'; return config; } }`);
    const config = await readConfig();

    expect(firstConfig).toBe(config);
    expect(config.webpack?.({})).toEqual({});
  });
});
