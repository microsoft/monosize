import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import compareReports from './commands/compareReports.mjs';
import measure from './commands/measure.mjs';
import uploadReport from './commands/uploadReport.mjs';

const cliSetup = yargs(hideBin(process.argv))
  .command(compareReports)
  .command(measure)
  .command(uploadReport)
  .option('quiet', {
    alias: 'q',
    type: 'boolean',
    description: 'Suppress verbose build output',
    default: false,
  })
  .help()
  .scriptName('monosize')
  .version(false).argv;

export type CliOptions = { quiet: boolean };

export type { BundleSizeReport, MonoSizeConfig, StorageAdapter } from './types.mjs';

export default cliSetup;
