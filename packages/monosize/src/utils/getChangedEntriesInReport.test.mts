import { describe, expect, it } from 'vitest';

import { EMPTY_DIFF } from './calculateDiff.mjs';
import { type ComparedReport } from './compareResultsInReports.mjs';
import { getChangedEntriesInReport } from './getChangedEntriesInReport.mjs';

describe('getChangedEntriesInReport', () => {
  it('splits entries to changed an unchanged', () => {
    const report: ComparedReport = [
      { packageName: 'abc', name: 'abc-a', path: 'abc-a.js', minifiedSize: 0, gzippedSize: 0, diff: EMPTY_DIFF },
      {
        packageName: 'abc',
        name: 'abc-b',
        path: 'abc-b.js',
        minifiedSize: 0,
        gzippedSize: 0,
        diff: {
          empty: false,
          exceedsThreshold: false,

          minified: { delta: 0, percent: '0%' },
          gzip: { delta: 0, percent: '0%' },
        },
      },
      { packageName: 'xyz', name: 'xyz', path: 'xyz.js', minifiedSize: 0, gzippedSize: 0, diff: EMPTY_DIFF },
    ];
    const actual = getChangedEntriesInReport(report);

    expect(actual.changedEntries).toHaveLength(2);
    expect(actual.changedEntries[0]).toEqual(report[0]);
    expect(actual.changedEntries[1]).toEqual(report[2]);

    expect(actual.unchangedEntries).toHaveLength(1);
    expect(actual.unchangedEntries[0]).toEqual(report[1]);
  });
});
