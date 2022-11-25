import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as tmp from 'tmp';

import { readConfig } from './readConfig.mjs';

async function setup(configContent: string): Promise<string> {
  const packageDir = tmp.dirSync({ prefix: 'test-package', unsafeCleanup: true });
  const config = tmp.fileSync({ dir: packageDir.name, name: 'monosize.config.js' });

  const spy = jest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir.name);

  await fs.promises.writeFile(config.name, configContent);

  return path.relative(packageDir.name, config.name);
}

describe('readConfig', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
  });

  it('should read config from package', async () => {
    await setup(`module.exports = { webpack: (config) => { config.foo = 'bar'; return config; } }`);

    const config = await readConfig(true);

    expect(config.webpack({})).toEqual({ foo: 'bar' });
  });

  it('should return default webpack config if no config file defined', async () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const spy = jest.spyOn(process, 'cwd');
    spy.mockReturnValue(os.tmpdir());

    await readConfig(true);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('should cache config', async () => {
    process.env.NODE_ENV = 'production';

    await setup(`module.exports = { webpack: (config) => config }`);
    const firstConfig = await readConfig(true);

    await setup(`module.exports = { webpack: (config) => { config.foo = 'bar'; return config; } }`);
    const config = await readConfig();

    expect(firstConfig).toBe(config);
    expect(config.webpack({})).toEqual({});

    process.env.NODE_ENV = 'test';
  });
});
