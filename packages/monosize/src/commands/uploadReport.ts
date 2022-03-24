import * as chalk from 'chalk';
import { isCI } from 'ci-info';
import { CommandModule } from 'yargs';

import { CliOptions } from '../index';
import { collectLocalReport } from '../utils/collectLocalReport';
import { hrToSeconds } from '../utils/helpers';

type UploadOptions = CliOptions & { branch: string; 'commit-sha': string };

async function uploadReport(options: UploadOptions) {
  if (!isCI) {
    console.log(
      `${chalk.red('[e]')} This is command can be executed only in CI`
    );
    process.exit(1);
  }

  const { branch, 'commit-sha': commitSHA, quiet } = options;
  const startTime = process.hrtime();

  const localReportStartTime = process.hrtime();
  const localReport = await collectLocalReport();

  if (!quiet) {
    console.log(
      [
        chalk.blue('[i]'),
        `Local report prepared in ${hrToSeconds(
          process.hrtime(localReportStartTime)
        )}`,
      ].join(' ')
    );
  }

  if (!quiet) {
    console.log(`Completed in ${hrToSeconds(process.hrtime(startTime))}`);
  }
}

// ---

const api: CommandModule<Record<string, unknown>, UploadOptions> = {
  command: 'upload-report',
  describe: 'uploads local results to Azure Table Storage',
  builder: {
    branch: {
      type: 'string',
      description: 'A branch to associate a report',
      required: true,
    },
    'commit-sha': {
      type: 'string',
      description: 'Defines a commit sha for a report',
      required: true,
    },
  },
  handler: uploadReport,
};

export default api;
