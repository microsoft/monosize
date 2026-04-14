import process from 'node:process';
import { styleText } from 'node:util';

import { formatHrTime } from './utils/helpers.mjs';

type LogFunction = (message: unknown, timestamp?: ReturnType<typeof process.hrtime>) => void;
type LogTypes = 'error' | 'info' | 'success' | 'finish';

export const timestamp = (): ReturnType<typeof process.hrtime> => process.hrtime();

function toFriendlyTime(time?: ReturnType<typeof process.hrtime>) {
  if (!time) {
    return '';
  }

  return styleText('dim', `(${formatHrTime(process.hrtime(time))})`);
}

/* eslint-disable no-console */

export const logger: Record<LogTypes, LogFunction> & { raw: (...args: unknown[]) => void } = {
  // Logging functions
  // These functions are used to log messages to the console with different styles and colors
  error: (message, time) => {
    console.error(styleText('red', '[e]'), message, toFriendlyTime(time));
  },
  info: (message, time) => {
    if (time) {
      console.info(styleText('blue', '[i]'), message, toFriendlyTime(time));
      return;
    }

    console.info(styleText('blue', '[i]'), message);
  },
  success: (message, time) => {
    console.log(styleText('green', '[✔]'), message, toFriendlyTime(time));
  },

  // Special logging for the end of the process
  finish: (message, time) => {
    console.log(styleText(['bgGreenBright', 'black'], `  🏁 ${message}  `), toFriendlyTime(time));
  },

  // Raw logging function i.e. console.log()
  raw: (...args) => {
    console.log(...args);
  },
};
