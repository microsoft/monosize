import { calculateDiff, EMPTY_DIFF, type DiffForEntry } from './calculateDiff.mjs';
import type { BundleSizeReport, BundleSizeReportEntry, ThresholdValue } from '../types.mjs';

export type ComparedReportEntry = BundleSizeReportEntry & { diff: DiffForEntry };
export type ComparedReport = ComparedReportEntry[];

export function compareResultsInReports(
  localReport: BundleSizeReport,
  remoteReport: BundleSizeReport,
  threshold: ThresholdValue,
): ComparedReport {
  return localReport.map(localEntry => {
    const remoteEntry = remoteReport.find(
      entry => localEntry.packageName === entry.packageName && localEntry.path === entry.path,
    );

    if (remoteEntry) {
      return {
        ...localEntry,
        diff: calculateDiff({
          localEntry,
          remoteEntry,
          threshold,
        }),
      };
    }

    return {
      ...localEntry,
      diff: EMPTY_DIFF,
    };
  });
}
