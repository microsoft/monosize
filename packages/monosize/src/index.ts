import * as yargs from 'yargs';

const cliSetup = yargs
  .commandDir('commands', {
    visit: exports => exports.default,
  })
  .option('quiet', {
    alias: 'q',
    type: 'boolean',
    description: 'Suppress verbose build output',
    default: false,
  })
  .scriptName('monosize')
  .version(false).argv;

export type CliOptions = { quiet: boolean };

export type { BundleSizeReport, StorageAdapter } from './types';

export default cliSetup;
