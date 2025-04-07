import type { DiffByMetric } from '../utils/calculateDiff.mjs';
import type { ComparedReport } from '../utils/compareResultsInReports.mjs';
import { formatBytes } from '../utils/helpers.mjs';

export type Reporter = (
  report: ComparedReport,
  options: { commitSHA: string; repository: string; showUnchanged: boolean; deltaFormat: keyof DiffByMetric },
) => void;

export function formatDeltaFactory(
  diff: DiffByMetric,
  options: { deltaFormat: keyof DiffByMetric; directionSymbol: (value: number) => string },
) {
  const { deltaFormat, directionSymbol } = options;

  if (diff.delta === 0) {
    return '';
  }

  const deltaOutput = deltaFormat === 'delta' ? formatBytes(diff[deltaFormat]) : diff[deltaFormat];

  return { deltaOutput, dirSymbol: directionSymbol(diff.delta) };
}
