import { fileURLToPath } from 'node:url';
import { findPackageRoot } from 'workspace-tools';

import { getChangedEntriesInReport } from '../utils/getChangedEntriesInReport.mjs';
import { formatBytes } from '../utils/helpers.mjs';
import type { DiffByMetric } from '../utils/calculateDiffByMetric.mjs';
import type { Reporter } from './shared.mjs';

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

function formatDelta(diff: DiffByMetric): string {
  if (diff.delta === 0) {
    return '';
  }

  return `\`${formatBytes(diff.delta)}\` ${getDirectionSymbol(diff.delta)}`;
}

export const markdownReporter: Reporter = (report, options) => {
  const { commitSHA, repository, showUnchanged } = options;
  const footer = `<sub>🤖 This report was generated against <a href='${repository}/commit/${commitSHA}'>${commitSHA}</a></sub>`;

  assertPackageRoot();

  const { changedEntries, unchangedEntries } = getChangedEntriesInReport(report);

  const reportOutput = ['## 📊 Bundle size report', ''];

  if (changedEntries.length === 0) {
    reportOutput.push(`✅ No changes found`);
    console.log(reportOutput.join('\n'));
    return;
  }

  if (changedEntries.length > 0) {
    reportOutput.push('| Package & Exports | Baseline (minified/GZIP) | PR    | Change     |');
    reportOutput.push('| :---------------- | -----------------------: | ----: | ---------: |');

    changedEntries.forEach(entry => {
      const title = `<samp>${entry.packageName}</samp> <br /> <abbr title='${entry.path}'>${entry.name}</abbr>`;
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
        : [`${formatDelta(entry.diff.minified)}`, '<br />', `${formatDelta(entry.diff.gzip)}`].join('');

      reportOutput.push(`| ${title} | ${before} | ${after} | ${difference}|`);
    });

    reportOutput.push('');
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

  console.log(reportOutput.join('\n'));
};

function assertPackageRoot() {
  const dirname = fileURLToPath(new URL('.', import.meta.url));
  const packageRoot = findPackageRoot(dirname);

  if (!packageRoot) {
    throw new Error(
      [
        'Failed to find a package root (directory that contains "package.json" file)',
        `Lookup start in: ${dirname}`,
      ].join('\n'),
    );
  }
}
