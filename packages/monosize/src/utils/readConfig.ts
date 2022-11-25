import { findUp } from 'find-up';
import { Configuration as WebpackConfiguration } from 'webpack';

import { StorageAdapter } from '../types';
import * as pc from 'picocolors';

export type MonoSizeConfig = {
  repository: string;
  storage: StorageAdapter;
  webpack: (config: WebpackConfiguration) => WebpackConfiguration;
};

const CONFIG_FILE_NAME = 'monosize.config.js';
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

  cache = {
    ...defaultConfig,
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ...require(configPath),
  } as MonoSizeConfig;

  return cache;
}
