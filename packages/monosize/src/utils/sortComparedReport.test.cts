import { ComparedReport, emptyDiff } from './compareResultsInReports';
import { sortComparedReport } from './sortComparedReport';

describe('sortComparedReport', () => {
  it('sorts a report by "packageName" & "path', () => {
    const report: ComparedReport = [
      { packageName: 'bcd', name: 'BCD-B', path: 'bcd-b.js', minifiedSize: 0, gzippedSize: 0, diff: emptyDiff },
      { packageName: 'bcd', name: 'BCD-A', path: 'bcd-a.js', minifiedSize: 0, gzippedSize: 0, diff: emptyDiff },
      { packageName: 'abc', name: 'ABC', path: 'abc.js', minifiedSize: 0, gzippedSize: 0, diff: emptyDiff },
    ];
    const actual = sortComparedReport(report);

    expect(actual[0]).toEqual(report[2]);
    expect(actual[1]).toEqual(report[1]);
    expect(actual[2]).toEqual(report[0]);
  });
});
