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

  it('gates each entry on its own captured threshold, falling back per entry', () => {
    // `one` grew 3 kB and carries a strict `2 kB` threshold -> exceeds.
    // `two` grew the same 3 kB but carries a lax `5 kB` threshold -> within.
    // `three` carries no threshold and relies on the passed fallback (2 kB) -> exceeds.
    const localReport: BundleSizeReport = [
      { packageName: 'one', name: 'one', path: 'one.js', minifiedSize: 4072, gzippedSize: 500, threshold: '2 kB' },
      { packageName: 'two', name: 'two', path: 'two.js', minifiedSize: 4072, gzippedSize: 500, threshold: '5 kB' },
      { packageName: 'three', name: 'three', path: 'three.js', minifiedSize: 4072, gzippedSize: 500 },
    ];
    const remoteReport: BundleSizeReport = [
      { packageName: 'one', name: 'one', path: 'one.js', minifiedSize: 1000, gzippedSize: 100 },
      { packageName: 'two', name: 'two', path: 'two.js', minifiedSize: 1000, gzippedSize: 100 },
      { packageName: 'three', name: 'three', path: 'three.js', minifiedSize: 1000, gzippedSize: 100 },
    ];
    const fallbackThreshold = { size: 2048, type: 'size' } as const;

    const actual = compareResultsInReports(localReport, remoteReport, fallbackThreshold);

    expect(actual.map(entry => [entry.packageName, entry.diff.exceedsThreshold])).toEqual([
      ['one', true],
      ['two', false],
      ['three', true],
    ]);
  });

  it('throws when a captured threshold is malformed', () => {
    const localReport: BundleSizeReport = [
      { packageName: 'one', name: 'one', path: 'one.js', minifiedSize: 4072, gzippedSize: 500, threshold: 'nonsense' },
    ];
    const remoteReport: BundleSizeReport = [
      { packageName: 'one', name: 'one', path: 'one.js', minifiedSize: 1000, gzippedSize: 100 },
    ];
    const fallbackThreshold = { size: 2048, type: 'size' } as const;

    expect(() => compareResultsInReports(localReport, remoteReport, fallbackThreshold)).toThrow(
      /Invalid threshold value/,
    );
  });
});
