import type { BundleSizeReportEntry, ThresholdValue } from '../types.mjs';

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

export function calculateDiff(params: {
  localEntry: DiffEntry;
  remoteEntry: DiffEntry;
  threshold: ThresholdValue;
}): DiffForEntry {
  const { localEntry, remoteEntry } = params;

  const minifiedDelta = localEntry.minifiedSize - remoteEntry.minifiedSize;
  const minifiedPercent = remoteEntry.minifiedSize === 0 ? 0 : minifiedDelta / remoteEntry.minifiedSize;

  const gzippedDelta = localEntry.gzippedSize - remoteEntry.gzippedSize;
  const gzippedPercent = remoteEntry.gzippedSize === 0 ? 0 : gzippedDelta / remoteEntry.gzippedSize;

  let exceedsThreshold = false;

  if (params.threshold.type === 'size') {
    if (minifiedDelta > 0 && minifiedDelta >= params.threshold.size) {
      exceedsThreshold = true;
    }
  } else if (params.threshold.type === 'percent') {
    if (minifiedPercent > 0 && minifiedPercent >= params.threshold.size / 100) {
      exceedsThreshold = true;
    }
  }

  return {
    empty: false,
    exceedsThreshold,

    minified: {
      delta: minifiedDelta,
      percent: formatPercent(minifiedPercent),
    },
    gzip: {
      delta: gzippedDelta,
      percent: formatPercent(gzippedPercent),
    },
  };
}
