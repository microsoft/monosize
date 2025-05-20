import { describe, expect, test } from 'vitest';

import type { ThresholdValue } from '../types.mjs';
import { calculateDiff } from './calculateDiff.mjs';

const DEFAULT_THRESHOLD: ThresholdValue = { size: 1000, type: 'size' };

describe('calculateDiff', () => {
  test('calculates difference deltas and percents', () => {
    const localEntry = { minifiedSize: 1500, gzippedSize: 150 };
    const remoteEntry = { minifiedSize: 1000, gzippedSize: 100 };

    expect(
      calculateDiff({
        localEntry,
        remoteEntry,
        threshold: DEFAULT_THRESHOLD,
      }),
    ).toEqual({
      empty: false,
      exceedsThreshold: false,
      minified: { delta: 500, percent: '50%' },
      gzip: { delta: 50, percent: '50%' },
    });
  });

  test('handles zero values', () => {
    const localEntry = { minifiedSize: 100, gzippedSize: 10 };
    const remoteEntry = { minifiedSize: 100, gzippedSize: 10 };

    expect(
      calculateDiff({
        localEntry,
        remoteEntry,
        threshold: DEFAULT_THRESHOLD,
      }),
    ).toEqual({
      empty: false,
      exceedsThreshold: false,
      minified: { delta: 0, percent: '0%' },
      gzip: { delta: 0, percent: '0%' },
    });
  });

  describe('threshold', () => {
    test('handles size threshold', () => {
      const localEntry = { minifiedSize: 200, gzippedSize: 20 };
      const remoteEntry = { minifiedSize: 100, gzippedSize: 10 };
      const threshold: ThresholdValue = { size: 100, type: 'size' };

      expect(
        calculateDiff({
          localEntry,
          remoteEntry,
          threshold,
        }),
      ).toMatchObject({
        exceedsThreshold: true,
      });
    });

    test('handles percent threshold', () => {
      const localEntry = { minifiedSize: 200, gzippedSize: 20 };
      const remoteEntry = { minifiedSize: 100, gzippedSize: 10 };
      const threshold: ThresholdValue = { size: 40, type: 'percent' };

      expect(
        calculateDiff({
          localEntry,
          remoteEntry,
          threshold,
        }),
      ).toMatchObject({
        exceedsThreshold: true,
      });
    });
  });
});
