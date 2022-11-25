import { findUp } from 'find-up';
import pc from 'picocolors';

import type { MonoSizeConfig } from '../types.mjs';

const CONFIG_FILE_NAME = ['monosize.config.js', 'monosize.config.mjs'];
const defaultConfig: Partial<MonoSizeConfig> = {
  webpack: config => config,
};

let cache: MonoSizeConfig;

export async function readConfig(quiet = true): Promise<MonoSizeConfig> {
  // don't use the cache in tests
  if (cache && process.env.NODE_ENV !== 'test') {
    return cache;
  }

  const configPath = await findUp(CONFIG_FILE_NAME, { cwd: process.cwd() });

  if (!configPath) {
    console.log([pc.red('[e]'), `No config file found in ${configPath}`].join(' '));
    process.exit(1);
  }

  if (!quiet) {
    console.log([pc.blue('[i]'), `Using following config ${configPath}`].join(' '));
  }

  // TODO: config validation via schema
  let userConfig;

  if (process.env.NODE_ENV === 'test') {
    // Jest does not support ESM imports natively
    userConfig = require(configPath);
  } else {
    const configFile = await import(configPath);

    userConfig = configFile.default;
  }

  cache = {
    ...defaultConfig,
    ...userConfig,
  } as MonoSizeConfig;

  return cache;
}
