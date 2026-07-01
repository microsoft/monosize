import { describe, expect, it } from 'vitest';

import { compareResultsInReports } from './compareResultsInReports.mjs';
import type { BundleSizeReport } from '../types.mjs';

describe('compareResultsInReports', () => {
  it('compares local and remote reports', () => {
    const localReport: BundleSizeReport = [
      { packageName: 'abc', name: 'abc-a', path: 'abc-b.js', minifiedSize: 10, gzippedSize: 5 },
      { packageName: 'abc', name: 'abc-b', path: 'abc-a.js', minifiedSize: 10, gzippedSize: 5 },
      { packageName: 'xyz', name: 'xyz', path: 'xyz.js', minifiedSize: 10, gzippedSize: 5 },
    ];
    const remoteReport: BundleSizeReport = [
      { packageName: 'abc', name: 'abc-a', path: 'abc-b.js', minifiedSize: 12, gzippedSize: 7 },
      { packageName: 'xyz', name: 'xyz', path: 'xyz.js', minifiedSize: 10, gzippedSize: 5 },
    ];
    const threshold = { size: 5, type: 'size' } as const;

    const actual = compareResultsInReports(localReport, remoteReport, threshold);
    const packageAbcReport = {
      fileAbcA: actual[0],
      fileAbcB: actual[1],
    };
    const packageXyzReport = actual[2];

    expect(packageAbcReport.fileAbcA).toMatchInlineSnapshot(`
      {
        "diff": {
          "empty": false,
          "exceedsThreshold": false,
          "gzip": {
            "delta": -2,
            "percent": "-28.6%",
          },
          "minified": {
            "delta": -2,
            "percent": "-16.7%",
          },
        },
        "gzippedSize": 5,
        "minifiedSize": 10,
        "name": "abc-a",
        "packageName": "abc",
        "path": "abc-b.js",
      }
    `);
    expect(packageAbcReport.fileAbcB).toMatchInlineSnapshot(`
      {
        "diff": {
          "empty": true,
          "exceedsThreshold": false,
          "gzip": {
            "delta": 1,
            "percent": "100%",
          },
          "minified": {
            "delta": 1,
            "percent": "100%",
          },
        },
        "gzippedSize": 5,
        "minifiedSize": 10,
        "name": "abc-b",
        "packageName": "abc",
        "path": "abc-a.js",
      }
    `);
    expect(packageXyzReport).toMatchInlineSnapshot(`
      {
        "diff": {
          "empty": false,
          "exceedsThreshold": false,
          "gzip": {
            "delta": 0,
            "percent": "0%",
          },
          "minified": {
            "delta": 0,
            "percent": "0%",
          },
        },
        "gzippedSize": 5,
        "minifiedSize": 10,
        "name": "xyz",
        "packageName": "xyz",
        "path": "xyz.js",
      }
    `);
  });

  it('applies per-package threshold when a resolver function is provided', () => {
    const localReport: BundleSizeReport = [
      { packageName: 'strict-pkg', name: 'entry', path: 'entry.js', minifiedSize: 110, gzippedSize: 50 },
      { packageName: 'lenient-pkg', name: 'entry', path: 'entry.js', minifiedSize: 110, gzippedSize: 50 },
    ];
    const remoteReport: BundleSizeReport = [
      { packageName: 'strict-pkg', name: 'entry', path: 'entry.js', minifiedSize: 100, gzippedSize: 40 },
      { packageName: 'lenient-pkg', name: 'entry', path: 'entry.js', minifiedSize: 100, gzippedSize: 40 },
    ];

    // strict-pkg uses a 5% threshold (10% increase exceeds it)
    // lenient-pkg uses a 20% threshold (10% increase is within it)
    const thresholdResolver = (packageName: string) => {
      if (packageName === 'strict-pkg') return { size: 5, type: 'percent' as const };
      return { size: 20, type: 'percent' as const };
    };

    const result = compareResultsInReports(localReport, remoteReport, thresholdResolver);

    expect(result[0].diff.exceedsThreshold).toBe(true);
    expect(result[1].diff.exceedsThreshold).toBe(false);
  });
});
