import { CommandModule } from 'yargs';

import { CliOptions } from '../index.mjs';
import { cliReporter } from '../reporters/cliReporter.mjs';
import { markdownReporter } from '../reporters/markdownReporter.mjs';
import { collectLocalReport } from '../utils/collectLocalReport.mjs';
import { compareResultsInReports } from '../utils/compareResultsInReports.mjs';
import { readConfig } from '../utils/readConfig.mjs';
import type { DiffByMetric } from '../utils/calculateDiff.mjs';
import type { ThresholdValue } from '../types.mjs';
import { logger, timestamp } from '../logger.mjs';
import { parseThreshold } from '../utils/helpers.mjs';

export type CompareReportsOptions = CliOptions & {
  branch: string;
  'report-files-glob'?: string;
  output: 'cli' | 'markdown';
  deltaFormat: keyof DiffByMetric;
};

export const DEFAULT_THRESHOLD = '10%';

/**
 * Builds a per-package threshold resolver from the config value.
 *
 * - When `configThreshold` is a plain string (or `undefined`), every package
 *   uses the same parsed threshold.
 * - When `configThreshold` is a `Record<string, string>`, each package looks
 *   up its own entry; packages not listed fall back to `DEFAULT_THRESHOLD`.
 */
export function buildThresholdResolver(
  configThreshold: string | Record<string, string> | undefined,
): (packageName: string) => ThresholdValue {
  if (typeof configThreshold === 'object' && configThreshold !== null) {
    return (packageName: string) => parseThreshold(configThreshold[packageName] ?? DEFAULT_THRESHOLD);
  }

  const parsed = parseThreshold(configThreshold ?? DEFAULT_THRESHOLD);
  return () => parsed;
}

async function compareReports(options: CompareReportsOptions) {
  const { branch, output, quiet, deltaFormat } = options;
  const startTime = timestamp();

  const config = await readConfig(quiet);
  const thresholdResolver = buildThresholdResolver(config.threshold);

  const localReportStartTime = timestamp();
  const localReport = await collectLocalReport({
    ...config,
    reportFilesGlob: options['report-files-glob'],
  });

  if (!quiet) {
    logger.info(`Local report prepared`, localReportStartTime);
  }

  const remoteReportStartTime = timestamp();
  const { commitSHA, remoteReport } = await config.storage.getRemoteReport(branch);

  if (!quiet) {
    if (commitSHA === '') {
      logger.info(`Remote report for "${branch}" branch was not found`);
    } else {
      logger.info(`Remote report for "${commitSHA}" commit fetched `, remoteReportStartTime);
    }
  }

  const reportsComparisonResult = compareResultsInReports(localReport, remoteReport, thresholdResolver);

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
  const hasExceededThreshold = reportsComparisonResult.some(entry => entry.diff.exceedsThreshold);

  if (!quiet) {
    if (hasExceededThreshold) {
      logger.error(`Some entries exceeded the threshold`);
    }

    logger.finish(`Completed`, startTime);
  }

  if (hasExceededThreshold) {
    process.exit(1);
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
