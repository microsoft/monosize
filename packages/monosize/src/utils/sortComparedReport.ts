import { ComparedReport, ComparedReportEntry } from './compareResultsInReports';

function compareReports(a: ComparedReportEntry, b: ComparedReportEntry) {
  return a.packageName.localeCompare(b.packageName) || a.path.localeCompare(b.path);
}

/**
 * Sorts entries in a report by "packageName" & "path".
 */
export function sortComparedReport(report: ComparedReport) {
  return report.slice().sort(compareReports);
}
