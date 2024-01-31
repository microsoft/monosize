import type { BundleSizeReport } from 'monosize';

export const sampleReport: BundleSizeReport = [
  {
    packageName: '@scope/foo-package',
    name: 'Foo',
    path: 'foo.fixture.js',
    minifiedSize: 1000,
    gzippedSize: 100,
  },
  {
    packageName: '@scope/bar-package',
    name: 'Bar',
    path: 'bar.fixture.js',
    minifiedSize: 1000,
    gzippedSize: 100,
  },
];

export const bigReport: BundleSizeReport = new Array(200).fill(null).map((_, index) => ({
  packageName: '@scope/foo-package',
  name: `Entry [${index}]`,
  path: `foo-${index}.fixture.js`,
  minifiedSize: 1000,
  gzippedSize: 100,
}));
