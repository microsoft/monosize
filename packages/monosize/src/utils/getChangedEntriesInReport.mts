import type { ComparedReport, ComparedReportEntry } from './compareResultsInReports.mjs';
import { sortComparedReport } from './sortComparedReport.mjs';

type EntriesInReport = {
  changedEntries: ComparedReport;
  unchangedEntries: ComparedReport;
};

/**
 * An entry is "unchanged" iff totals are flat AND every per-type delta
 * is zero (across both `minified` and `gzip`). The breakdown check
 * surfaces fixtures whose totals net to zero but where one asset type
 * regressed and another shrank — those would otherwise be silently
 * dropped from the diff output.
 */
function isUnchanged(entry: ComparedReportEntry): boolean {
  const totalsFlat = entry.diff.gzip.delta === 0 && entry.diff.minified.delta === 0;
  if (!totalsFlat) return false;
  if (!entry.assetsDiff) return true;
  return Object.values(entry.assetsDiff).every(d => d.minified.delta === 0 && d.gzip.delta === 0);
}

export function getChangedEntriesInReport(report: ComparedReport): EntriesInReport {
  const { changedEntries, unchangedEntries } = report.reduce<EntriesInReport>(
    (acc, reportEntry) => {
      if (isUnchanged(reportEntry)) {
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
