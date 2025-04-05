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
});
