import { calculateAssetDiff, calculateDiff, EMPTY_DIFF, type AssetDiff, type DiffForEntry } from './calculateDiff.mjs';
import type { BundleSizeReport, BundleSizeReportEntry, ThresholdValue } from '../types.mjs';

export type ComparedReportEntry = BundleSizeReportEntry & {
  diff: DiffForEntry;
  /**
   * Per-asset-type breakdown of deltas. Absent when neither side carried
   * `assets` (legacy report). When present, keys are the union of
   * `Object.keys(local.assets)` and `Object.keys(remote.assets)` so a
   * type only present on one side surfaces as a positive/negative delta.
   *
   * Keys are typed as `string` rather than `AssetType` so future-version
   * JSON carrying unknown types (e.g. a stored `assets.svg`) flows through
   * without TypeScript narrowing dropping it.
   */
  assetsDiff?: Record<string, AssetDiff>;
};
export type ComparedReport = ComparedReportEntry[];

function buildAssetsDiff(
  localAssets: BundleSizeReportEntry['assets'],
  remoteAssets: BundleSizeReportEntry['assets'],
): Record<string, AssetDiff> | undefined {
  // Both sides must carry `assets` for a meaningful per-type comparison.
  // When either side is missing (typically: remote was written before the
  // assets field existed), suppress assetsDiff so reporters can render the
  // "breakdown unavailable" legend instead of presenting a fabricated diff
  // against an unknown baseline.
  if (!localAssets || !remoteAssets) {
    return undefined;
  }

  const keys = new Set<string>([...Object.keys(localAssets), ...Object.keys(remoteAssets)]);
  const result: Record<string, AssetDiff> = {};
  for (const key of [...keys].sort()) {
    result[key] = calculateAssetDiff(localAssets[key as keyof typeof localAssets], remoteAssets[key as keyof typeof remoteAssets]);
  }
  return result;
}

export function compareResultsInReports(
  localReport: BundleSizeReport,
  remoteReport: BundleSizeReport,
  threshold: ThresholdValue,
): ComparedReport {
  return localReport.map(localEntry => {
    const remoteEntry = remoteReport.find(
      entry => localEntry.packageName === entry.packageName && localEntry.path === entry.path,
    );

    const assetsDiff = remoteEntry ? buildAssetsDiff(localEntry.assets, remoteEntry.assets) : undefined;

    if (remoteEntry) {
      return {
        ...localEntry,
        diff: calculateDiff({
          localEntry,
          remoteEntry,
          threshold,
        }),
        ...(assetsDiff && { assetsDiff }),
      };
    }

    return {
      ...localEntry,
      diff: EMPTY_DIFF,
    };
  });
}
