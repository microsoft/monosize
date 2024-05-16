import pc from 'picocolors';
import { CommandModule } from 'yargs';

import { CliOptions } from '../index.mjs';
import { cliReporter } from '../reporters/cliReporter.mjs';
import { markdownReporter } from '../reporters/markdownReporter.mjs';
import { collectLocalReport } from '../utils/collectLocalReport.mjs';
import { compareResultsInReports } from '../utils/compareResultsInReports.mjs';
import { hrToSeconds } from '../utils/helpers.mjs';
import { readConfig } from '../utils/readConfig.mjs';
import type { DiffByMetric } from '../utils/calculateDiffByMetric.mjs';

export type CompareReportsOptions = CliOptions & {
  branch: string;
  'report-files-glob'?: string;
  output: 'cli' | 'markdown';
  deltaFormat: keyof DiffByMetric;
};

async function compareReports(options: CompareReportsOptions) {
  const { branch, output, quiet, deltaFormat } = options;
  const startTime = process.hrtime();

  const config = await readConfig(quiet);

  const localReportStartTime = process.hrtime();
  const localReport = await collectLocalReport({
    ...config,
    reportFilesGlob: options['report-files-glob'] ?? undefined,
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

  const reportsComparisonResult = compareResultsInReports(localReport, remoteReport);

  switch (output) {
    case 'cli':
      cliReporter(reportsComparisonResult, {
        commitSHA,
        repository: config.repository,
        showUnchanged: false,
        deltaFormat: deltaFormat ?? 'percent',
      });
      break;
    case 'markdown':
      markdownReporter(reportsComparisonResult, {
        commitSHA,
        repository: config.repository,
        showUnchanged: true,
        deltaFormat: deltaFormat ?? 'delta',
      });
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
    deltaFormat: {
      type: 'string',
      choices: ['delta', 'percent'],
      description: 'Defines format of delta output',
    },
  },
  handler: compareReports,
};

export default api;
