import * as findUp from 'find-up';
import { Configuration as WebpackConfiguration } from 'webpack';

import { StorageAdapter } from '../types';

export type MonoSizeConfig = {
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

  // TODO: better logging

  if (!configPath) {
    console.log(`no config file found: ${configPath}\n`);
    process.exit(1);
  }

  if (!quiet) {
    console.log(`using config: ${configPath}`);
  }

  // TODO: config validation via schema

  cache = {
    ...defaultConfig,
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ...require(configPath),
  } as MonoSizeConfig;

  return cache;
}
