import process from 'node:process';
import pc from 'picocolors';

import { formatHrTime } from './utils/helpers.mjs';

type LogFunction = (message: unknown, time?: ReturnType<typeof process.hrtime>) => void;
type LogTypes = 'error' | 'info' | 'success' | 'finish';

export const timestamp = () => process.hrtime();

export const log: Record<LogTypes | 'raw', LogFunction> = {
  error: (message, time) => {
    if (time) {
      console.error(pc.red('[e]'), message, pc.dim(`(${formatHrTime(process.hrtime(time))})`));
      return;
    }

    console.error(pc.red('[e]'), message);
  },
  info: (message, time) => {
    if (time) {
      console.info(pc.blue('[i]'), message, pc.dim(`(${formatHrTime(process.hrtime(time))})`));
      return;
    }

    console.info(pc.blue('[i]'), message);
  },
  success: (message, time) => {
    if (time) {
      console.log(pc.green('[✔]'), message, pc.dim(`(${formatHrTime(process.hrtime(time))})`));
      return;
    }

    console.log(pc.green('[✔]'), message);
  },

  finish: (message, time) => {
    if (time) {
      console.log(
        pc.bgGreenBright(`  🏁 ${pc.black(message as string)}  `),
        pc.dim(`(${formatHrTime(process.hrtime(time))})`),
      );
      return;
    }

    console.log(pc.bgGreenBright(`  🏁 ${pc.black(message as string)}  `));
  },
  raw: message => {
    console.log(message);
  },
};
