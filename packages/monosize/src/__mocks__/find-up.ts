import * as fs from 'fs';
import * as path from 'path';

export const findUp: typeof import('find-up').findUp = async (configName, options) => {
  const filePath = path.resolve(options?.cwd, configName as string);

  if (fs.existsSync(filePath)) {
    return filePath;
  }

  return undefined;
};
