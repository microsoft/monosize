import yargs from 'yargs';

import compareReports from './commands/compareReports.mjs';
import measure from './commands/measure.mjs';
import uploadReport from './commands/uploadReport.mjs';

const cliSetup = yargs(process.argv)
  .command(compareReports)
  .command(measure)
  .command(uploadReport)
  .option('quiet', {
    alias: 'q',
    type: 'boolean',
    description: 'Suppress verbose build output',
    default: false,
  })
  .showHelp()
  .scriptName('monosize')
  .version(false).argv;

export type CliOptions = { quiet: boolean };

export type { BundleSizeReport, StorageAdapter } from './types.mjs';

export default cliSetup;
