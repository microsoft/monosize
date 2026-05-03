import type { BundleSizeReport } from '../types.mjs';

export const sampleReport: BundleSizeReport = [
  {
    packageName: 'foo-package',
    name: 'New entry',
    path: 'foo.fixture.js',
    minifiedSize: 1000,
    gzippedSize: 100,
    assets: { js: { minifiedSize: 1000, gzippedSize: 100 } },
  },
  {
    packageName: 'bar-package',
    name: 'An entry without diff',
    path: 'bar.fixture.js',
    minifiedSize: 1000,
    gzippedSize: 100,
    // No assets — exercises the legacy-report path in comparisons.
  },
  {
    packageName: 'baz-package',
    name: 'An entry with diff',
    path: 'baz.fixture.js',
    minifiedSize: 1000,
    gzippedSize: 100,
    assets: {
      js: { minifiedSize: 700, gzippedSize: 70 },
      css: { minifiedSize: 300, gzippedSize: 30 },
    },
  },
];
