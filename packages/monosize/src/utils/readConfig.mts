import { findUp } from 'find-up';
import { pathToFileURL } from 'node:url';

import { logger } from '../logger.mjs';
import type { MonoSizeConfig } from '../types.mjs';

const CONFIG_FILE_NAME = ['monosize.config.js', 'monosize.config.mjs'];

let cache: MonoSizeConfig | undefined;

export function resetConfigCache() {
  cache = undefined;
}

export async function readConfig(quiet = true): Promise<MonoSizeConfig> {
  // don't use the cache in tests
  if (cache && process.env.NODE_ENV !== 'test') {
    return cache;
  }

  const configPath = await findUp(CONFIG_FILE_NAME, { cwd: process.cwd() });

  if (!configPath) {
    logger.error(`No config file found in ${configPath}`);
    process.exit(1);
  }

  if (!quiet) {
    logger.info(`Using following config ${configPath}`);
  }

  const configFile = await import(pathToFileURL(configPath).toString());
  // TODO: config validation via schema
  const userConfig = configFile.default;

  cache = { ...userConfig } as MonoSizeConfig;

  return cache;
}
