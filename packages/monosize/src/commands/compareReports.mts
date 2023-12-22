import pc from 'picocolors';
import { CommandModule } from 'yargs';

import { CliOptions } from '../index.mjs';
import { cliReporter } from '../reporters/cliReporter.mjs';
import { markdownReporter } from '../reporters/markdownReporter.mjs';
import { collectLocalReport } from '../utils/collectLocalReport.mjs';
import { compareResultsInReports } from '../utils/compareResultsInReports.mjs';
import { hrToSeconds } from '../utils/helpers.mjs';
import { readConfig } from '../utils/readConfig.mjs';

export type CompareReportsOptions = CliOptions & {
  branch: string;
  'report-files-glob'?: string;
  output: 'cli' | 'markdown';
};

async function compareReports(options: CompareReportsOptions) {
  const { branch, output, quiet } = options;
  const startTime = process.hrtime();

  const config = await readConfig(quiet);

  const localReportStartTime = process.hrtime();
  const localReport = await collectLocalReport({
    ...(options['report-files-glob'] && { reportFilesGlob: options['report-files-glob'] }),
  });

  if (!quiet) {
    console.log(
      [pc.blue('[i]'), `Local report prepared in ${hrToSeconds(process.hrtime(localReportStartTime))}`].join(' '),
    );
  }

  const remoteReportStartTime = process.hrtime();
  const { commitSHA, remoteReport } = await config.storage.getRemoteReport(branch);

  if (!quiet) {
    if (commitSHA === '') {
      console.log([pc.blue('[i]'), `Remote report for "${branch}" branch was not found`].join(' '));
    } else {
      console.log(
        [
          pc.blue('[i]'),
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
      await markdownReporter(result, commitSHA, config.repository, quiet);
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
    'report-files-glob': {
      type: 'string',
      description: 'A glob pattern to search for report files in JSON format',
      required: false,
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
