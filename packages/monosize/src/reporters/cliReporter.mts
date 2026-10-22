import Table from 'cli-table3';
import { styleText } from 'node:util';

import { getChangedEntriesInReport } from '../utils/getChangedEntriesInReport.mjs';
import { formatBytes } from '../utils/helpers.mjs';
import type { AssetDiff, DiffByMetric } from '../utils/calculateDiff.mjs';
import type { ComparedReportEntry } from '../utils/compareResultsInReports.mjs';
import type { AssetSize } from '../types.mjs';
import { logger } from '../logger.mjs';
import { formatDeltaFactory, type Reporter } from './shared.mjs';

type Row = [string, string, string];

function getDirectionSymbol(value: number): string {
  if (value < 0) return '↓';
  if (value > 0) return '↑';
  return '';
}

function formatDelta(diff: DiffByMetric, deltaFormat: keyof DiffByMetric, baseline: number | undefined): string {
  const output = formatDeltaFactory(diff, {
    // Percentage change from a zero baseline is undefined; show the byte delta instead.
    deltaFormat: baseline === 0 ? 'delta' : deltaFormat,
    directionSymbol: getDirectionSymbol,
  });
  const color = diff.delta > 0 ? ('red' as const) : ('green' as const);

  return typeof output === 'string' ? output : styleText(color, output.deltaOutput + output.dirSymbol);
}

function buildSizeColumns(
  size: AssetSize,
  diff: AssetDiff | undefined,
  deltaFormat: keyof DiffByMetric,
  empty = false,
): [string, string] {
  const minifiedBefore = !diff || empty ? undefined : size.minifiedSize - diff.minified.delta;
  const gzippedBefore = !diff || empty ? undefined : size.gzippedSize - diff.gzip.delta;
  // A new entry has no known baseline, so its top-level percentage is
  // intentionally different from a known zero baseline, which uses bytes.
  const before = [minifiedBefore, gzippedBefore]
    .map(baseline => (baseline === undefined ? 'N/A' : formatBytes(baseline)))
    .join('\n');
  const after = [
    [diff && formatDelta(diff.minified, deltaFormat, minifiedBefore), formatBytes(size.minifiedSize)]
      .filter(Boolean)
      .join(' '),
    [diff && formatDelta(diff.gzip, deltaFormat, gzippedBefore), formatBytes(size.gzippedSize)]
      .filter(Boolean)
      .join(' '),
  ].join('\n');

  return [before, after];
}

function buildEntryRow(entry: ComparedReportEntry, deltaFormat: keyof DiffByMetric): Row {
  const { diff, name, packageName } = entry;

  const fixtureColumn = [
    styleText('bold', packageName),
    name + (diff.empty ? styleText('cyan', ' (new)') : ''),
    diff.exceedsThreshold && styleText('red', `(${styleText('bold', '!')} over threshold)`),
  ]
    .filter(Boolean)
    .join('\n');

  return [fixtureColumn, ...buildSizeColumns(entry, diff, deltaFormat, diff.empty)];
}

function buildBreakdownRows(entry: ComparedReportEntry, deltaFormat: keyof DiffByMetric): Row[] {
  const assets: Record<string, AssetSize | undefined> = entry.assets ?? {};
  // Include removed types and unknown types from reports written by newer versions.
  const types = [...new Set([...Object.keys(assets), ...Object.keys(entry.assetsDiff ?? {})])].sort();

  return types.map(type => {
    const size = assets[type] ?? { minifiedSize: 0, gzippedSize: 0 };
    return [styleText('dim', `  ${type}`), ...buildSizeColumns(size, entry.assetsDiff?.[type], deltaFormat)];
  });
}

export const cliReporter: Reporter = (report, options) => {
  const { commitSHA, repository, deltaFormat } = options;
  const { changedEntries } = getChangedEntriesInReport(report);

  if (changedEntries.length === 0) {
    logger.success('No changes found');
    return;
  }

  const table = new Table({
    colAligns: ['left', 'right', 'right'],
    head: ['Fixture', 'Before', 'After (minified/GZIP)'],
  });

  for (const entry of changedEntries) {
    table.push(buildEntryRow(entry, deltaFormat));
    for (const row of buildBreakdownRows(entry, deltaFormat)) {
      table.push(row);
    }
  }

  const footer = `🤖 This report was generated against '${repository}/commit/${commitSHA}'`;
  logger.raw(table.toString());
  logger.raw('');
  logger.raw(footer);
};
