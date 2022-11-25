import fs from 'fs';
import path from 'path';

export const findUp: typeof import('find-up').findUp = async (configName, options) => {
  const filePath = path.resolve(
    (options?.cwd as string | undefined) || '',
    Array.isArray(configName) ? configName[0] : configName,
  );

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  return undefined;
};
