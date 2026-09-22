import stripAnsi from 'strip-ansi';
import { beforeEach, describe, it, expect, vitest } from 'vitest';

import { cliReporter } from './cliReporter.mjs';
import { sampleComparedReport, reportWithExceededThreshold } from '../__fixtures__/sampleComparedReport.mjs';
import { logger } from '../logger.mjs';
import { compareResultsInReports, type ComparedReport } from '../utils/compareResultsInReports.mjs';
import type { AssetSize, BundleSizeReportEntry } from '../types.mjs';
import { tableRows } from '../__fixtures__/tableRows.mjs';

function noop() {
  /* does nothing */
}

// We are using "chalk" and "cli-table3" in this reporter, they are adding colors to the output via escape codes that
// makes snapshots look ugly.
//
// It could be disabled for "chalk" but "colors" that is used "cli-table3" is not our dependency.
expect.addSnapshotSerializer({
  test(val) {
    return typeof val === 'string';
  },
  print(val) {
    return stripAnsi(val as string);
  },
});

describe('cliReporter', () => {
  const options = {
    repository: 'https://github.com/microsoft/monosize',
    commitSHA: 'commit-hash',
    showUnchanged: false,
    deltaFormat: 'percent' as const,
  };

  beforeEach(() => {
    vitest.clearAllMocks();
  });

  it('wont render anything if there is nothing to compare', () => {
    const logSpy = vitest.spyOn(logger, 'success').mockImplementation(noop);

    cliReporter([], options);

    expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot('No changes found');
  });

  it('renders a report to CLI output', () => {
    const logSpy = vitest.spyOn(console, 'log').mockImplementation(noop);

    cliReporter(sampleComparedReport, options);

    expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌────────────────────┬────────┬───────────────────────┐
      │ Fixture            │ Before │ After (minified/GZIP) │
      ├────────────────────┼────────┼───────────────────────┤
      │ baz-package        │    0 B │            1 kB↑ 1 kB │
      │ An entry with diff │    0 B │          100 B↑ 100 B │
      ├────────────────────┼────────┼───────────────────────┤
      │   css              │    0 B │          300 B↑ 300 B │
      │                    │    0 B │            30 B↑ 30 B │
      ├────────────────────┼────────┼───────────────────────┤
      │   js               │    0 B │          700 B↑ 700 B │
      │                    │    0 B │            70 B↑ 70 B │
      ├────────────────────┼────────┼───────────────────────┤
      │ foo-package        │    N/A │            100%↑ 1 kB │
      │ New entry (new)    │    N/A │           100%↑ 100 B │
      └────────────────────┴────────┴───────────────────────┘
    `);
  });

  it('renders a report to CLI output with specified "deltaFormat"', () => {
    const logSpy = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    cliReporter(sampleComparedReport, { ...options, deltaFormat: 'delta' });

    expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌────────────────────┬────────┬───────────────────────┐
      │ Fixture            │ Before │ After (minified/GZIP) │
      ├────────────────────┼────────┼───────────────────────┤
      │ baz-package        │    0 B │            1 kB↑ 1 kB │
      │ An entry with diff │    0 B │          100 B↑ 100 B │
      ├────────────────────┼────────┼───────────────────────┤
      │   css              │    0 B │          300 B↑ 300 B │
      │                    │    0 B │            30 B↑ 30 B │
      ├────────────────────┼────────┼───────────────────────┤
      │   js               │    0 B │          700 B↑ 700 B │
      │                    │    0 B │            70 B↑ 70 B │
      ├────────────────────┼────────┼───────────────────────┤
      │ foo-package        │    N/A │             1 B↑ 1 kB │
      │ New entry (new)    │    N/A │            1 B↑ 100 B │
      └────────────────────┴────────┴───────────────────────┘
    `);
  });

  it.each(['css', 'js', 'json'] as const)('renders a breakdown for a single %s asset type', type => {
    const logSpy = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    const singleTypeReport: ComparedReport = [
      {
        packageName: 'single-type-pkg',
        name: 'Single-type entry',
        path: 'single-type.fixture.js',
        minifiedSize: 700,
        gzippedSize: 70,
        assets: {
          [type]: { minifiedSize: 700, gzippedSize: 70 },
        },
        diff: {
          empty: false,
          exceedsThreshold: false,
          minified: { delta: 700, percent: '100%' },
          gzip: { delta: 70, percent: '100%' },
        },
        assetsDiff: {
          [type]: { minified: { delta: 700, percent: '100%' }, gzip: { delta: 70, percent: '100%' } },
        },
      },
    ];

    cliReporter(singleTypeReport, options);

    expect(tableRows(logSpy.mock.calls[0][0])).toEqual([
      ['Fixture', 'Before', 'After (minified/GZIP)'],
      ['single-type-pkg', '0 B', '700 B↑ 700 B'],
      ['Single-type entry', '0 B', '70 B↑ 70 B'],
      [type, '0 B', '700 B↑ 700 B'],
      ['', '0 B', '70 B↑ 70 B'],
    ]);
  });

  describe('asset sizes from compared reports', () => {
    function renderAssetRows(
      localAssets: Record<string, AssetSize>,
      remoteAssets: Record<string, AssetSize> | undefined | 'new',
      deltaFormat: 'delta' | 'percent' = 'delta',
    ): string[][] {
      function entry(assets: Record<string, AssetSize> | undefined): BundleSizeReportEntry {
        const sizes = Object.values(assets ?? {});
        return {
          packageName: 'pkg',
          name: 'fixture',
          path: 'fixture.js',
          minifiedSize: sizes.reduce((sum, size) => sum + size.minifiedSize, 0),
          gzippedSize: sizes.reduce((sum, size) => sum + size.gzippedSize, 0),
          assets,
        };
      }

      const report = compareResultsInReports(
        [entry(localAssets)],
        remoteAssets === 'new' ? [] : [entry(remoteAssets)],
        { type: 'size', size: 1000 },
      );
      const logSpy = vitest.spyOn(logger, 'raw').mockImplementation(noop);

      cliReporter(report, { ...options, deltaFormat });

      return tableRows(logSpy.mock.calls[0][0]).slice(3);
    }

    it.each(['delta', 'percent'] as const)('shows all types when only CSS changes (%s)', deltaFormat => {
      const rows = renderAssetRows(
        {
          json: { minifiedSize: 20, gzippedSize: 2 },
          js: { minifiedSize: 100, gzippedSize: 10 },
          css: { minifiedSize: 60, gzippedSize: 6 },
        },
        {
          css: { minifiedSize: 50, gzippedSize: 5 },
          js: { minifiedSize: 100, gzippedSize: 10 },
          json: { minifiedSize: 20, gzippedSize: 2 },
        },
        deltaFormat,
      );

      expect(rows).toEqual([
        ['css', '50 B', `${deltaFormat === 'delta' ? '10 B' : '20%'}↑ 60 B`],
        ['', '5 B', `${deltaFormat === 'delta' ? '1 B' : '20%'}↑ 6 B`],
        ['js', '100 B', '100 B'],
        ['', '10 B', '10 B'],
        ['json', '20 B', '20 B'],
        ['', '2 B', '2 B'],
      ]);
    });

    it.each(['delta', 'percent'] as const)(
      'shows added and removed types with zero on the absent side (%s)',
      deltaFormat => {
        expect(
          renderAssetRows(
            {
              js: { minifiedSize: 100, gzippedSize: 10 },
              json: { minifiedSize: 20, gzippedSize: 2 },
            },
            {
              js: { minifiedSize: 100, gzippedSize: 10 },
              css: { minifiedSize: 50, gzippedSize: 5 },
            },
            deltaFormat,
          ),
        ).toEqual([
          ['css', '50 B', `${deltaFormat === 'delta' ? '-50 B' : '-100%'}↓ 0 B`],
          ['', '5 B', `${deltaFormat === 'delta' ? '-5 B' : '-100%'}↓ 0 B`],
          ['js', '100 B', '100 B'],
          ['', '10 B', '10 B'],
          ['json', '0 B', '20 B↑ 20 B'],
          ['', '0 B', '2 B↑ 2 B'],
        ]);
      },
    );

    it.each([
      {
        baseline: { minifiedSize: 0, gzippedSize: 10 },
        expected: [
          ['css', '0 B', '20 B↑ 20 B'],
          ['', '10 B', '100%↑ 20 B'],
        ],
      },
      {
        baseline: { minifiedSize: 10, gzippedSize: 0 },
        expected: [
          ['css', '10 B', '100%↑ 20 B'],
          ['', '0 B', '20 B↑ 20 B'],
        ],
      },
      {
        baseline: { minifiedSize: 0, gzippedSize: 0 },
        expected: [
          ['css', '0 B', '20 B↑ 20 B'],
          ['', '0 B', '20 B↑ 20 B'],
        ],
      },
    ])('falls back to bytes independently for zero-baseline metrics ($baseline)', ({ baseline, expected }) => {
      expect(renderAssetRows({ css: { minifiedSize: 20, gzippedSize: 20 } }, { css: baseline }, 'percent')).toEqual(
        expected,
      );
    });

    it('keeps unchanged zero-size metrics free of deltas in percent mode', () => {
      expect(
        renderAssetRows(
          { css: { minifiedSize: 0, gzippedSize: 20 } },
          { css: { minifiedSize: 0, gzippedSize: 10 } },
          'percent',
        ),
      ).toEqual([
        ['css', '0 B', '0 B'],
        ['', '10 B', '100%↑ 20 B'],
      ]);
    });

    it('shows per-type changes even when totals are unchanged', () => {
      expect(
        renderAssetRows(
          {
            js: { minifiedSize: 90, gzippedSize: 9 },
            css: { minifiedSize: 60, gzippedSize: 6 },
          },
          {
            js: { minifiedSize: 100, gzippedSize: 10 },
            css: { minifiedSize: 50, gzippedSize: 5 },
          },
        ),
      ).toEqual([
        ['css', '50 B', '10 B↑ 60 B'],
        ['', '5 B', '1 B↑ 6 B'],
        ['js', '100 B', '-10 B↓ 90 B'],
        ['', '10 B', '-1 B↓ 9 B'],
      ]);
    });

    it('shows unchanged minified sizes for gzip-only changes', () => {
      expect(
        renderAssetRows({ css: { minifiedSize: 50, gzippedSize: 6 } }, { css: { minifiedSize: 50, gzippedSize: 5 } }),
      ).toEqual([
        ['css', '50 B', '50 B'],
        ['', '5 B', '1 B↑ 6 B'],
      ]);
    });

    it.each(['new', undefined] as const)('does not invent per-type baselines or deltas for %s reports', remote => {
      expect(
        renderAssetRows(
          {
            js: { minifiedSize: 100, gzippedSize: 10 },
            css: { minifiedSize: 50, gzippedSize: 5 },
            json: { minifiedSize: 20, gzippedSize: 2 },
          },
          remote,
        ),
      ).toEqual([
        ['css', 'N/A', '50 B'],
        ['', 'N/A', '5 B'],
        ['js', 'N/A', '100 B'],
        ['', 'N/A', '10 B'],
        ['json', 'N/A', '20 B'],
        ['', 'N/A', '2 B'],
      ]);
    });

    it('shows removed assets when the current breakdown is empty', () => {
      expect(renderAssetRows({}, { css: { minifiedSize: 50, gzippedSize: 5 } })).toEqual([
        ['css', '50 B', '-50 B↓ 0 B'],
        ['', '5 B', '-5 B↓ 0 B'],
      ]);
    });

    it('preserves unknown asset types from future reports', () => {
      expect(
        renderAssetRows({ svg: { minifiedSize: 40, gzippedSize: 4 } }, { svg: { minifiedSize: 50, gzippedSize: 5 } }),
      ).toEqual([
        ['svg', '50 B', '-10 B↓ 40 B'],
        ['', '5 B', '-1 B↓ 4 B'],
      ]);
    });
  });

  it('renders a report with exceeded threshold', () => {
    const logSpy = vitest.spyOn(logger, 'raw').mockImplementation(noop);

    cliReporter(reportWithExceededThreshold, { ...options, deltaFormat: 'delta' });

    expect(logSpy.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌────────────────────┬────────┬───────────────────────┐
      │ Fixture            │ Before │ After (minified/GZIP) │
      ├────────────────────┼────────┼───────────────────────┤
      │ baz-package        │    0 B │            1 kB↑ 1 kB │
      │ An entry with diff │    0 B │          100 B↑ 100 B │
      │ (! over threshold) │        │                       │
      ├────────────────────┼────────┼───────────────────────┤
      │   css              │    0 B │          300 B↑ 300 B │
      │                    │    0 B │            30 B↑ 30 B │
      ├────────────────────┼────────┼───────────────────────┤
      │   js               │    0 B │          700 B↑ 700 B │
      │                    │    0 B │            70 B↑ 70 B │
      └────────────────────┴────────┴───────────────────────┘
    `);
  });
});
