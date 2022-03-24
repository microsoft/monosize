import { BundleSizeReportEntry } from '../types';

export type DiffByMetric = { delta: number; percent: string };

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

export function calculateDiffByMetric(
  local: BundleSizeReportEntry,
  remote: BundleSizeReportEntry,
  property: 'minifiedSize' | 'gzippedSize',
): DiffByMetric {
  const delta = local[property] - remote[property];
  const percent = remote[property] === 0 ? 0 : delta / remote[property];

  return { delta, percent: formatPercent(percent) };
}
