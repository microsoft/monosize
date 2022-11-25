import Table from 'cli-table3';
import * as pc from 'picocolors';

import { getChangedEntriesInReport } from '../utils/getChangedEntriesInReport.mjs';
import { formatBytes } from '../utils/helpers.mjs';
import type { DiffByMetric } from '../utils/calculateDiffByMetric.mjs';
import type { ComparedReport } from '../utils/compareResultsInReports.mjs';

function getDirectionSymbol(value: number): string {
  if (value < 0) {
    return '↓';
  }

  if (value > 0) {
    return '↑';
  }

  return '';
}

function formatDelta(diff: DiffByMetric): string {
  if (diff.delta === 0) {
    return '';
  }

  const colorFn = diff.delta > 0 ? pc.red : pc.green;

  return colorFn(diff.percent + getDirectionSymbol(diff.delta));
}

export async function cliReporter(report: ComparedReport): Promise<void> {
  const result = new Table({
    colAligns: ['left', 'right', 'right'],
    head: ['Fixture', 'Before', 'After (minified/GZIP)'],
  });
  const { changedEntries } = getChangedEntriesInReport(report);

  changedEntries.forEach(entry => {
    const { diff, gzippedSize, minifiedSize, name, packageName } = entry;
    const fixtureColumn = pc.bold(packageName) + '\n' + name + (diff.empty ? pc.cyan(' (new)') : '');

    const minifiedBefore = diff.empty ? 'N/A' : formatBytes(minifiedSize - diff.minified.delta);
    const gzippedBefore = diff.empty ? 'N/A' : formatBytes(gzippedSize - diff.gzip.delta);

    const minifiedAfter = formatBytes(minifiedSize);
    const gzippedAfter = formatBytes(gzippedSize);

    const beforeColumn = minifiedBefore + '\n' + gzippedBefore;
    const afterColumn =
      formatDelta(diff.minified) + ' ' + minifiedAfter + '\n' + formatDelta(diff.gzip) + ' ' + gzippedAfter;

    result.push([fixtureColumn, beforeColumn, afterColumn]);
  });

  if (result.length > 0) {
    console.log(result.toString());
    return;
  }

  console.log(`${pc.green('[✔]')} No changes found`);
}
