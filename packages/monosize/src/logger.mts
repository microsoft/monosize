import process from 'node:process';
import pc from 'picocolors';

import { formatHrTime } from './utils/helpers.mjs';

type LogFunction = (message: unknown, timestamp?: ReturnType<typeof process.hrtime>) => void;
type LogTypes = 'error' | 'info' | 'success' | 'finish';

export const timestamp = () => process.hrtime();

function toFriendlyTime(time?: ReturnType<typeof process.hrtime>) {
  if (!time) {
    return '';
  }

  return pc.dim(`(${formatHrTime(process.hrtime(time))})`);
}

/* eslint-disable no-console */

export const logger: Record<LogTypes, LogFunction> & { raw: (...args: unknown[]) => void } = {
  // Logging functions
  // These functions are used to log messages to the console with different styles and colors
  error: (message, time) => {
    console.error(pc.red('[e]'), message, toFriendlyTime(time));
  },
  info: (message, time) => {
    if (time) {
      console.info(pc.blue('[i]'), message, toFriendlyTime(time));
      return;
    }

    console.info(pc.blue('[i]'), message);
  },
  success: (message, time) => {
    console.log(pc.green('[✔]'), message, toFriendlyTime(time));
  },

  // Special logging for the end of the process
  finish: (message, time) => {
    console.log(pc.bgGreenBright(`  🏁 ${pc.black(message as string)}  `), toFriendlyTime(time));
  },

  // Raw logging function i.e. console.log()
  raw: (...args) => {
    console.log(...args);
  },
};
