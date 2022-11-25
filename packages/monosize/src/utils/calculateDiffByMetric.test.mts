import { calculateDiffByMetric } from './calculateDiffByMetric.mjs';
import type { BundleSizeReportEntry } from '../types.mjs';

describe('calculateDiffByMetric', () => {
  it('calculates difference deltas and percents', () => {
    const remoteEntry: BundleSizeReportEntry = {
      packageName: 'test-package',
      name: 'Test',
      path: 'test.fixture.js',
      minifiedSize: 1000,
      gzippedSize: 100,
    };
    const localEntry: BundleSizeReportEntry = {
      packageName: 'test-package',
      name: 'Test',
      path: 'test.fixture.js',
      minifiedSize: 1500,
      gzippedSize: 150,
    };

    expect(calculateDiffByMetric(localEntry, remoteEntry, 'minifiedSize')).toEqual({
      delta: 500,
      percent: '50%',
    });
    expect(calculateDiffByMetric(localEntry, remoteEntry, 'gzippedSize')).toEqual({
      delta: 50,
      percent: '50%',
    });
  });

  it('handles zero values', () => {
    const remoteEntry: BundleSizeReportEntry = {
      packageName: 'test-package',
      name: 'Test',
      path: 'test.fixture.js',
      minifiedSize: 0,
      gzippedSize: 0,
    };
    const localEntry: BundleSizeReportEntry = {
      packageName: 'test-package',
      name: 'Test',
      path: 'test.fixture.js',
      minifiedSize: 0,
      gzippedSize: 0,
    };

    expect(calculateDiffByMetric(localEntry, remoteEntry, 'minifiedSize')).toEqual({
      delta: 0,
      percent: '0%',
    });
    expect(calculateDiffByMetric(localEntry, remoteEntry, 'gzippedSize')).toEqual({
      delta: 0,
      percent: '0%',
    });
  });
});
