import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as prettier from 'prettier';
import { findPackageRoot } from 'workspace-tools';

import { ComparedReport } from '../utils/compareResultsInReports';
import { DiffByMetric } from '../utils/calculateDiffByMetric';
import { getChangedEntriesInReport } from '../utils/getChangedEntriesInReport';
import { formatBytes } from '../utils/helpers';

const icons = {
  increase: 'IncreaseYellow.svg',
  decrease: 'Decrease.svg',
};

function getDirectionSymbol(value: number): string {
  const img = (iconName: string) =>
    `<img aria-hidden="true" src="https://microsoft.github.io/sizeAuditor-website/images/icons/${iconName}" />`;

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

export async function markdownReporter(result: ComparedReport, commitSHA: string, quiet: boolean) {
  const packageRoot = findPackageRoot(__dirname);

  if (!packageRoot) {
    throw new Error(
      [
        'Failed to find a package root (directory that contains "package.json" file)',
        `Lookup start in: ${__dirname}`,
      ].join('\n'),
    );
  }

  const artifactsDir = path.resolve(packageRoot, 'dist');
  const artifactsFilename = path.join(artifactsDir, 'monosize.md');

  const report = [];

  report.push('## 📊 Bundle size report');
  report.push('');

  const { changedEntries, unchangedEntries } = getChangedEntriesInReport(result);

  if (changedEntries.length > 0) {
    report.push('| Package & Exports | Baseline (minified/GZIP) | PR    | Change     |');
    report.push('| :---------------- | -----------------------: | ----: | ---------: |');

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

      report.push(`| ${title} | ${before} | ${after} | ${difference}|`);
    });

    report.push('');
  }

  if (unchangedEntries.length > 0) {
    report.push('<details>');
    report.push('<summary>Unchanged fixtures</summary>');
    report.push('');

    report.push('| Package & Exports | Size (minified/GZIP) |');
    report.push('| ----------------- | -------------------: |');

    unchangedEntries.forEach(entry => {
      const title = `<samp>${entry.packageName}</samp> <br /> <abbr title='${entry.path}'>${entry.name}</abbr>`;
      const size = [`\`${formatBytes(entry.minifiedSize)}\``, '<br />', `\`${formatBytes(entry.gzippedSize)}\``].join(
        '',
      );

      report.push(`| ${title} | ${size} |`);
    });

    report.push('</details>');
  }

  // TODO: use repo settings
  report.push(
    `<sub>🤖 This report was generated against <a href='https://github.com/microsoft/fluentui/commit/${commitSHA}'>${commitSHA}</a></sub>`,
  );

  await fs.promises.mkdir(artifactsDir, { recursive: true });
  await fs.promises.writeFile(artifactsFilename, prettier.format(report.join('\n'), { parser: 'markdown' }));

  if (!quiet) {
    console.log([chalk.blue('[i]'), `A report file was written to ${artifactsFilename}`].join(' '));
  }
}
