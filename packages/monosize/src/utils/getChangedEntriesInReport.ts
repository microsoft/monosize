import { sortComparedReport } from './sortComparedReport';
import { ComparedReport } from './compareResultsInReports';

type EntriesInReport = {
  changedEntries: ComparedReport;
  unchangedEntries: ComparedReport;
};

export function getChangedEntriesInReport(report: ComparedReport): EntriesInReport {
  const { changedEntries, unchangedEntries } = report.reduce<EntriesInReport>(
    (acc, reportEntry) => {
      if (reportEntry.diff.gzip.delta === 0 && reportEntry.diff.minified.delta === 0) {
        acc.unchangedEntries.push(reportEntry);
        return acc;
      }

      acc.changedEntries.push(reportEntry);
      return acc;
    },
    { changedEntries: [], unchangedEntries: [] },
  );

  return {
    changedEntries: sortComparedReport(changedEntries),
    unchangedEntries: sortComparedReport(unchangedEntries),
  };
}
