import prettier from 'prettier';
import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { reportWithExceededThreshold, sampleComparedReport } from '../__fixtures__/sampleComparedReport.mjs';
import { logger } from '../logger.mjs';
import { markdownReporter } from './markdownReporter.mjs';
import { compareResultsInReports, type ComparedReport } from '../utils/compareResultsInReports.mjs';
import type { BundleSizeReportEntry } from '../types.mjs';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

describe('markdownReporter', () => {
  const options = {
    repository: 'https://github.com/microsoft/monosize',
    commitSHA: 'commit-hash',
    showUnchanged: true,
    deltaFormat: 'delta' as const,
  };

  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it('wont render anything if there is nothing to compare', async () => {
    const log = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    markdownReporter([], options);
    const output = await prettier.format(log.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toMatchInlineSnapshot(`
      "## 📊 Bundle size report

      ✅ No changes found
      "
    `);
  });

  it('renders a report to a file', async () => {
    const rawLog = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    markdownReporter(sampleComparedReport, options);
    const output = await prettier.format(rawLog.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toMatchSnapshot();
  });

  it('renders a report to a file with specified "deltaFormat"', async () => {
    const log = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    markdownReporter(sampleComparedReport, { ...options, deltaFormat: 'percent' });
    const output = await prettier.format(log.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toMatchSnapshot();
  });

  it('renders a Breakdown section for a single asset type', async () => {
    const log = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    const jsOnlyReport: ComparedReport = [
      {
        packageName: 'js-only-pkg',
        name: 'JS-only entry',
        path: 'js-only.fixture.js',
        minifiedSize: 700,
        gzippedSize: 70,
        assets: { js: { minifiedSize: 700, gzippedSize: 70 } },
        diff: {
          empty: false,
          exceedsThreshold: false,
          minified: { delta: 700, percent: '100%' },
          gzip: { delta: 70, percent: '100%' },
        },
        assetsDiff: {
          js: { minified: { delta: 700, percent: '100%' }, gzip: { delta: 70, percent: '100%' } },
        },
      },
    ];

    markdownReporter(jsOnlyReport, { ...options, showUnchanged: false });
    const output = await prettier.format(log.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toContain('### Breakdown');
    expect(output).toContain('| `js`');
  });

  it('renders a report with exceeded threshold', async () => {
    const log = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    markdownReporter(reportWithExceededThreshold, { ...options, deltaFormat: 'percent' });
    const output = await prettier.format(log.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toMatchSnapshot();
  });

  it('falls back to byte deltas for totals with a zero baseline', async () => {
    const log = vitest.spyOn(logger, 'raw').mockImplementation(noop);
    const entry = (minifiedSize: number, gzippedSize: number): BundleSizeReportEntry => ({
      packageName: 'zero-baseline-pkg',
      name: 'zero-baseline-entry',
      path: 'zero-baseline.fixture.js',
      minifiedSize,
      gzippedSize,
      assets: { js: { minifiedSize, gzippedSize } },
    });
    const report = compareResultsInReports([entry(20, 2)], [entry(0, 0)], { type: 'size', size: 1000 });

    markdownReporter(report, { ...options, deltaFormat: 'percent' });
    const output = await prettier.format(log.mock.calls[0][0] as string, { parser: 'markdown' });

    expect(output).toContain('| `20 B`<br />`2 B` |');
    expect(output).not.toContain('0%');
  });
});
