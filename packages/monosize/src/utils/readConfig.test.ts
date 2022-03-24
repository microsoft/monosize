import * as fs from 'fs';
import * as path from 'path';
import * as tmp from 'tmp';

import { readConfig } from './readConfig';

async function setup(configContent: string, pwdNesting = 0): Promise<string> {
  let packageDir = tmp.dirSync({ prefix: 'test-package', unsafeCleanup: true });
  const config = tmp.fileSync({ dir: packageDir.name, name: 'monosize.config.js' });

  for (let i = 0; i < pwdNesting; i++) {
    packageDir = tmp.dirSync({ dir: packageDir.name, prefix: 'nested', unsafeCleanup: true });
  }

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

    const config = await readConfig();

    expect(config.webpack({})).toEqual({ foo: 'bar' });
  });

  it('should return default webpack config if no config file defined', async () => {
    const exit = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await readConfig();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('should cache config', async () => {
    process.env.NODE_ENV = 'production';

    await setup(`module.exports = { webpack: (config) => config }`);
    const firstConfig = await readConfig();

    await setup(`module.exports = { webpack: (config) => { config.foo = 'bar'; return config; } }`);
    const config = await readConfig();

    expect(firstConfig).toBe(config);
    expect(config.webpack({})).toEqual({});

    process.env.NODE_ENV = 'test';
  });

  it.each([1, 2, 3])('should cache config for %i layers of nesting', async nesting => {
    await setup(`module.exports = { webpack: (config) => { config.foo = 'bar'; return config; } }`, nesting);
    const config = await readConfig();

    expect(config.webpack({})).toEqual({ foo: 'bar' });
  });
});
