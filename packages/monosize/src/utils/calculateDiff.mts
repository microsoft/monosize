import type { AssetSize, BundleSizeReportEntry, ThresholdValue } from '../types.mjs';

export type DiffByMetric = {
  delta: number;
  percent: string;
};

export type DiffForEntry = {
  empty: boolean;
  exceedsThreshold: boolean;

  minified: DiffByMetric;
  gzip: DiffByMetric;
};

/**
 * Per-asset-type diff. Mirrors `DiffForEntry`'s `minified`/`gzip` shape
 * but carries no `exceedsThreshold` — the threshold gates on totals only,
 * never on per-type deltas.
 */
export type AssetDiff = {
  minified: DiffByMetric;
  gzip: DiffByMetric;
};

type DiffEntry = Pick<BundleSizeReportEntry, 'minifiedSize' | 'gzippedSize'>;

export const EMPTY_DIFF: DiffForEntry = Object.freeze({
  empty: true,
  exceedsThreshold: false,

  minified: { delta: 1, percent: '100%' },
  gzip: { delta: 1, percent: '100%' },
});

const formatter = new Intl.NumberFormat([], { style: 'percent', maximumSignificantDigits: 3 });

function roundNumber(value: number, fractionDigits: number): number {
  return Number(value.toFixed(fractionDigits));
}

function formatPercent(fraction: number): string {
  if (fraction < 0.001) {
    return formatter.format(roundNumber(fraction, 4));
  }

  if (fraction < 0.01) {
    return formatter.format(roundNumber(fraction, 3));
  }

  return formatter.format(roundNumber(fraction, 2));
}

function diffMetric(localSize: number, remoteSize: number): DiffByMetric {
  const delta = localSize - remoteSize;
  const percent = remoteSize === 0 ? 0 : delta / remoteSize;
  return { delta, percent: formatPercent(percent) };
}

export function calculateDiff(params: {
  localEntry: DiffEntry;
  remoteEntry: DiffEntry;
  threshold: ThresholdValue;
}): DiffForEntry {
  const { localEntry, remoteEntry } = params;

  const minified = diffMetric(localEntry.minifiedSize, remoteEntry.minifiedSize);
  const gzip = diffMetric(localEntry.gzippedSize, remoteEntry.gzippedSize);

  // Threshold gates on totals (minified) only. Per-type deltas never trigger.
  let exceedsThreshold = false;
  if (params.threshold.type === 'size') {
    if (minified.delta > 0 && minified.delta >= params.threshold.size) {
      exceedsThreshold = true;
    }
  } else if (params.threshold.type === 'percent') {
    const minifiedPercent = remoteEntry.minifiedSize === 0 ? 0 : minified.delta / remoteEntry.minifiedSize;
    if (minifiedPercent > 0 && minifiedPercent >= params.threshold.size / 100) {
      exceedsThreshold = true;
    }
  }

  return {
    empty: false,
    exceedsThreshold,
    minified,
    gzip,
  };
}

/**
 * Per-asset-type diff. Treats a missing side (asset only present in local
 * OR remote) as `{ minifiedSize: 0, gzippedSize: 0 }` — a brand-new type
 * surfaces as a positive delta, a removed type as a negative delta.
 */
export function calculateAssetDiff(local: AssetSize | undefined, remote: AssetSize | undefined): AssetDiff {
  const l = { minifiedSize: local?.minifiedSize ?? 0, gzippedSize: local?.gzippedSize ?? 0 };
  const r = { minifiedSize: remote?.minifiedSize ?? 0, gzippedSize: remote?.gzippedSize ?? 0 };
  return {
    minified: diffMetric(l.minifiedSize, r.minifiedSize),
    gzip: diffMetric(l.gzippedSize, r.gzippedSize),
  };
}
