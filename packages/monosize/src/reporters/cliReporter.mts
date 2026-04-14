import Table from 'cli-table3';
import { styleText } from 'node:util';

import { getChangedEntriesInReport } from '../utils/getChangedEntriesInReport.mjs';
import { formatBytes } from '../utils/helpers.mjs';
import type { DiffByMetric } from '../utils/calculateDiff.mjs';
import { logger } from '../logger.mjs';
import { formatDeltaFactory, type Reporter } from './shared.mjs';

function getDirectionSymbol(value: number): string {
  if (value < 0) {
    return '↓';
  }

  if (value > 0) {
    return '↑';
  }

  return '';
}

function formatDelta(diff: DiffByMetric, deltaFormat: keyof DiffByMetric): string {
  const output = formatDeltaFactory(diff, { deltaFormat, directionSymbol: getDirectionSymbol });

  const color = diff.delta > 0 ? 'red' : 'green';

  return typeof output === 'string' ? output : styleText(color as 'red' | 'green', output.deltaOutput + output.dirSymbol);
}

export const cliReporter: Reporter = (report, options) => {
  const { commitSHA, repository, deltaFormat } = options;
  const footer = `🤖 This report was generated against '${repository}/commit/${commitSHA}'`;

  const { changedEntries } = getChangedEntriesInReport(report);

  const reportOutput = new Table({
    colAligns: ['left', 'right', 'right'],
    head: ['Fixture', 'Before', 'After (minified/GZIP)'],
  });

  if (changedEntries.length === 0) {
    logger.success('No changes found');
    return;
  }

  changedEntries.forEach(entry => {
    const { diff, gzippedSize, minifiedSize, name, packageName } = entry;

    const primaryLine = styleText('bold', packageName);
    const secondaryLine = name + (diff.empty ? styleText('cyan', ' (new)') : '');
    const tertiaryLine = diff.exceedsThreshold ? styleText('red', `(${styleText('bold', '!')} over threshold)`) : undefined;
    const fixtureColumn = primaryLine + '\n' + secondaryLine + (tertiaryLine ? '\n' + tertiaryLine : '');

    const minifiedBefore = diff.empty ? 'N/A' : formatBytes(minifiedSize - diff.minified.delta);
    const gzippedBefore = diff.empty ? 'N/A' : formatBytes(gzippedSize - diff.gzip.delta);

    const minifiedAfter = formatBytes(minifiedSize);
    const gzippedAfter = formatBytes(gzippedSize);

    const beforeColumn = minifiedBefore + '\n' + gzippedBefore;
    const afterColumn =
      formatDelta(diff.minified, deltaFormat) +
      ' ' +
      minifiedAfter +
      '\n' +
      formatDelta(diff.gzip, deltaFormat) +
      ' ' +
      gzippedAfter;

    reportOutput.push([fixtureColumn, beforeColumn, afterColumn]);
  });

  logger.raw(reportOutput.toString());
  logger.raw('');
  logger.raw(footer);
};
