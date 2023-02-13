import type { BundleSizeReport } from 'monosize';

export const sampleReport: BundleSizeReport = [
  {
    packageName: 'foo-package',
    name: 'New entry',
    path: 'foo.fixture.js',
    minifiedSize: 1000,
    gzippedSize: 100,
  },
];
