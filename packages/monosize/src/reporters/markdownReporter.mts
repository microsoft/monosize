import { getChangedEntriesInReport } from '../utils/getChangedEntriesInReport.mjs';
import { formatBytes } from '../utils/helpers.mjs';
import type { DiffByMetric } from '../utils/calculateDiff.mjs';
import { formatDeltaFactory, type Reporter } from './shared.mjs';
import type { AssetSize } from '../types.mjs';
import { logger } from '../logger.mjs';

const icons = { increase: 'increase.png', decrease: 'decrease.png' };

function getDirectionSymbol(value: number): string {
  const img = (iconName: string) =>
    `<img aria-hidden="true" src="https://microsoft.github.io/monosize/images/${iconName}" />`;

  if (value < 0) {
    return img(icons.decrease);
  }

  if (value > 0) {
    return img(icons.increase);
  }

  return '';
}

function formatDelta(diff: DiffByMetric, deltaFormat: keyof DiffByMetric, baseline?: number): string {
  const output = formatDeltaFactory(diff, {
    deltaFormat: baseline === 0 ? 'delta' : deltaFormat,
    directionSymbol: getDirectionSymbol,
  });

  return typeof output === 'string' ? output : `\`${output.deltaOutput}\` ${output.dirSymbol}`;
}

export const markdownReporter: Reporter = (report, options) => {
  const { commitSHA, repository, showUnchanged, deltaFormat } = options;
  const footer = `<sub>🤖 This report was generated against <a href='${repository}/commit/${commitSHA}'>${commitSHA}</a></sub>`;

  const { changedEntries, unchangedEntries } = getChangedEntriesInReport(report);

  const reportOutput = ['## 📊 Bundle size report', ''];

  if (changedEntries.length === 0) {
    reportOutput.push(`✅ No changes found`);
    logger.raw(reportOutput.join('\n'));
    return;
  }

  if (changedEntries.length > 0) {
    reportOutput.push('| Package & Exports | Baseline (minified/GZIP) | PR    | Change     |');
    reportOutput.push('| :---------------- | -----------------------: | ----: | ---------: |');

    changedEntries.forEach(entry => {
      const primary = `<samp>${entry.packageName}</samp>`;
      const secondary = `<abbr title='${entry.path}'>${entry.name}</abbr>`;
      const tertiary = entry.diff.exceedsThreshold ? '⚠️ over threshold' : '';
      const name = `${primary} <br /> ${secondary} ${tertiary ? `<br /> ${tertiary}` : ''}`;

      const before = entry.diff.empty
        ? [`\`${formatBytes(0)}\``, '<br />', `\`${formatBytes(0)}\``].join('')
        : [
            `\`${formatBytes(entry.minifiedSize - entry.diff.minified.delta)}\``,
            '<br />',
            `\`${formatBytes(entry.gzippedSize - entry.diff.gzip.delta)}\``,
          ].join('');
      const after = [`\`${formatBytes(entry.minifiedSize)}\``, '<br />', `\`${formatBytes(entry.gzippedSize)}\``].join(
        '',
      );
      const difference = entry.diff.empty
        ? '🆕 New entry'
        : [
            `${formatDelta(entry.diff.minified, deltaFormat, entry.minifiedSize - entry.diff.minified.delta)}`,
            '<br />',
            `${formatDelta(entry.diff.gzip, deltaFormat, entry.gzippedSize - entry.diff.gzip.delta)}`,
          ].join('');

      reportOutput.push(`| ${name} | ${before} | ${after} | ${difference}|`);
    });

    reportOutput.push('');

    // Per-asset-type breakdown lives in its own section after the totals
    // table — GFM tables can't span sub-rows, so interleaving <details>
    // mid-table would break parsing. Keep every known type here, including
    // unchanged types, so Markdown and CLI expose the same data.
    const entriesWithBreakdown = changedEntries.flatMap(entry => {
      if (!entry.assets && !entry.assetsDiff) {
        return [];
      }
      const assets: Record<string, AssetSize | undefined> = entry.assets ?? {};
      const types = [...new Set([...Object.keys(assets), ...Object.keys(entry.assetsDiff ?? {})])].sort();
      return [{ entry, types }];
    });
    const missingBreakdown = changedEntries.some(entry => !entry.assetsDiff && !entry.diff.empty);

    if (entriesWithBreakdown.length > 0 || missingBreakdown) {
      reportOutput.push('### Breakdown', '');

      if (missingBreakdown) {
        reportOutput.push(
          '> Breakdown unavailable for some fixtures (remote report predates per-asset support — re-run measure on main to populate).',
          '',
        );
      }

      for (const { entry, types } of entriesWithBreakdown) {
        const assets: Record<string, AssetSize | undefined> = entry.assets ?? {};
        reportOutput.push(`<details><summary><samp>${entry.packageName}</samp> · ${entry.name}</summary>`, '');
        reportOutput.push('| Asset type | Baseline (minified/GZIP) | Current (minified/GZIP) | Change |');
        reportOutput.push('| :--------- | -----------------------: | ---------------------: | -----: |');
        for (const type of types) {
          const size = assets[type] ?? { minifiedSize: 0, gzippedSize: 0 };
          const diff = entry.assetsDiff?.[type];
          const minifiedBefore = diff ? size.minifiedSize - diff.minified.delta : undefined;
          const gzipBefore = diff ? size.gzippedSize - diff.gzip.delta : undefined;
          const before = diff
            ? `\`${formatBytes(minifiedBefore ?? 0)}\`<br />\`${formatBytes(gzipBefore ?? 0)}\``
            : 'N/A';
          const current = `\`${formatBytes(size.minifiedSize)}\`<br />\`${formatBytes(size.gzippedSize)}\``;
          const change = diff
            ? `${formatDelta(diff.minified, deltaFormat, minifiedBefore)}<br />${formatDelta(diff.gzip, deltaFormat, gzipBefore)}`
            : '';
          reportOutput.push(`| \`${type}\` | ${before} | ${current} | ${change} |`);
        }
        reportOutput.push('</details>', '');
      }
    }
  }

  if (showUnchanged && unchangedEntries.length > 0) {
    reportOutput.push('<details>');
    reportOutput.push('<summary>Unchanged fixtures</summary>');
    reportOutput.push('');

    reportOutput.push('| Package & Exports | Size (minified/GZIP) |');
    reportOutput.push('| ----------------- | -------------------: |');

    unchangedEntries.forEach(entry => {
      const title = `<samp>${entry.packageName}</samp> <br /> <abbr title='${entry.path}'>${entry.name}</abbr>`;
      const size = [`\`${formatBytes(entry.minifiedSize)}\``, '<br />', `\`${formatBytes(entry.gzippedSize)}\``].join(
        '',
      );

      reportOutput.push(`| ${title} | ${size} |`);
    });

    reportOutput.push('</details>');
  }

  // TODO: use repo settings
  reportOutput.push(footer);

  logger.raw(reportOutput.join('\n'));
};
