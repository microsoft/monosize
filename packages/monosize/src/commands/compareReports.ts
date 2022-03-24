import * as chalk from 'chalk';
import { CommandModule } from 'yargs';

import { CliOptions } from '../index';
import { cliReporter } from '../reporters/cliReporter';
import { markdownReporter } from '../reporters/markdownReporter';
import { collectLocalReport } from '../utils/collectLocalReport';
import { compareResultsInReports } from '../utils/compareResultsInReports';
import { hrToSeconds } from '../utils/helpers';
import { readConfig } from '../utils/readConfig';

export type CompareReportsOptions = CliOptions & { branch: string; output: 'cli' | 'markdown' };

async function compareReports(options: CompareReportsOptions) {
  const { branch, output, quiet } = options;
  const startTime = process.hrtime();

  const config = await readConfig();

  const localReportStartTime = process.hrtime();
  const localReport = await collectLocalReport();

  if (!quiet) {
    console.log(
      [chalk.blue('[i]'), `Local report prepared in ${hrToSeconds(process.hrtime(localReportStartTime))}`].join(' '),
    );
  }

  const remoteReportStartTime = process.hrtime();
  const { commitSHA, remoteReport } = await config.storage.getRemoteReport(branch);

  if (!quiet) {
    if (commitSHA === '') {
      console.log([chalk.blue('[i]'), `Remote report for "${branch}" branch was not found`].join(' '));
    } else {
      console.log(
        [
          chalk.blue('[i]'),
          `Remote report for "${commitSHA}" commit fetched in ${hrToSeconds(process.hrtime(remoteReportStartTime))}`,
        ].join(' '),
      );
    }
  }

  const result = compareResultsInReports(localReport, remoteReport);

  switch (output) {
    case 'cli':
      await cliReporter(result);
      break;
    case 'markdown':
      await markdownReporter(result, commitSHA, quiet);
      break;
  }

  if (!quiet) {
    console.log(`Completed in ${hrToSeconds(process.hrtime(startTime))}`);
  }
}

// ---

const api: CommandModule<Record<string, unknown>, CompareReportsOptions> = {
  command: 'compare-reports',
  describe: 'compares local and remote results',
  builder: {
    branch: {
      alias: 'b',
      type: 'string',
      description: 'A branch to compare against',
      default: 'main',
    },
    output: {
      alias: 'o',
      type: 'string',
      choices: ['cli', 'markdown'],
      description: 'Defines a reporter to produce output',
      default: 'cli',
    },
  },
  handler: compareReports,
};

export default api;
