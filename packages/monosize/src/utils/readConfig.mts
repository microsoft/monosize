import { any as findUp } from 'empathic/find';
import { pathToFileURL } from 'node:url';

import { logger } from '../logger.mjs';
import type { AssetType, LoadedMonoSizeConfig, MonoSizeConfig } from '../types.mjs';

const CONFIG_FILE_NAME = ['monosize.config.js', 'monosize.config.mjs'];

const KNOWN_ASSET_TYPES: readonly AssetType[] = ['js', 'json', 'css'];
const DEFAULT_ASSET_TYPES: readonly AssetType[] = ['js', 'json', 'css'];

let cache: LoadedMonoSizeConfig | undefined;

export function resetConfigCache(): void {
  cache = undefined;
}

function resolveAssetTypes(input: MonoSizeConfig['assetTypes']): AssetType[] {
  if (input === undefined) {
    return [...DEFAULT_ASSET_TYPES].sort();
  }

  for (const entry of input) {
    if (!KNOWN_ASSET_TYPES.includes(entry)) {
      throw new Error(
        `Unknown assetType "${entry}" in monosize.config. Allowed: ${KNOWN_ASSET_TYPES.join(', ')}`,
      );
    }
  }

  return Array.from(new Set(input)).sort();
}

export async function readConfig(quiet = true): Promise<LoadedMonoSizeConfig> {
  // don't use the cache in tests
  if (cache && process.env.NODE_ENV !== 'test') {
    return cache;
  }

  const configPath = findUp(CONFIG_FILE_NAME, { cwd: process.cwd() });

  if (!configPath) {
    logger.error(`No config file found in ${configPath}`);
    process.exit(1);
  }

  if (!quiet) {
    logger.info(`Using following config ${configPath}`);
  }

  const configFile = await import(pathToFileURL(configPath).toString());
  // TODO: full config validation via schema
  const userConfig = configFile.default as MonoSizeConfig;

  cache = {
    ...userConfig,
    assetTypes: resolveAssetTypes(userConfig.assetTypes),
  };

  return cache;
}
