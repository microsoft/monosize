import * as pc from 'picocolors';
import process from 'node:process';

type LogFunction = (message: unknown, time?: ReturnType<typeof process.hrtime>) => void;
type LogTypes = 'error' | 'info' | 'success' | 'finish';

export const timestamp = () => process.hrtime();

export const log: Record<LogTypes | 'raw', LogFunction> = {
  error: message => {
    console.error(pc.red('[e]'), message);
  },
  info: message => {
    console.info(pc.blue('[i]'), message);
  },
  success: message => {
    console.log(pc.green('[✔]'), message);
  },

  finish: message => {
    console.log(pc.bgWhite('🏁'), message);
  },
  raw: message => {
    console.log(message);
  },
};
