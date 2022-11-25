import { calculateDiffByMetric, DiffByMetric } from './calculateDiffByMetric.mjs';
import type { BundleSizeReport, BundleSizeReportEntry } from '../types.mjs';

type DiffForEntry = { empty: boolean; minified: DiffByMetric; gzip: DiffByMetric };

export type ComparedReportEntry = BundleSizeReportEntry & { diff: DiffForEntry };
export type ComparedReport = ComparedReportEntry[];

export const emptyDiff: DiffForEntry = Object.freeze({
  empty: true,

  minified: { delta: 1, percent: '100%' },
  gzip: { delta: 1, percent: '100%' },
});

export function compareResultsInReports(localReport: BundleSizeReport, remoteReport: BundleSizeReport): ComparedReport {
  return localReport.map(localEntry => {
    const remoteEntry = remoteReport.find(
      entry => localEntry.packageName === entry.packageName && localEntry.path === entry.path,
    );
    const diff = remoteEntry
      ? {
          empty: false,
          minified: calculateDiffByMetric(localEntry, remoteEntry, 'minifiedSize'),
          gzip: calculateDiffByMetric(localEntry, remoteEntry, 'gzippedSize'),
        }
      : emptyDiff;

    return {
      ...localEntry,
      diff,
    };
  });
}
