import { EMPTY_DIFF } from '../utils/calculateDiff.mjs';
import { type ComparedReport } from '../utils/compareResultsInReports.mjs';

export const sampleComparedReport: ComparedReport = [
  {
    packageName: 'foo-package',
    name: 'New entry',
    path: 'foo.fixture.js',
    minifiedSize: 1000,
    gzippedSize: 100,
    diff: EMPTY_DIFF,
  },
  {
    packageName: 'bar-package',
    name: 'An entry without diff',
    path: 'bar.fixture.js',
    minifiedSize: 1000,
    gzippedSize: 100,
    diff: {
      empty: false,
      exceedsThreshold: false,

      minified: { delta: 0, percent: '0%' },
      gzip: { delta: 0, percent: '0%' },
    },
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
    diff: {
      empty: false,
      exceedsThreshold: false,

      minified: { delta: 1000, percent: '100%' },
      gzip: { delta: 100, percent: '100%' },
    },
    assetsDiff: {
      css: { minified: { delta: 300, percent: '100%' }, gzip: { delta: 30, percent: '100%' } },
      js: { minified: { delta: 700, percent: '100%' }, gzip: { delta: 70, percent: '100%' } },
    },
  },
];

export const reportWithExceededThreshold: ComparedReport = [
  {
    packageName: 'bar-package',
    name: 'An entry without diff',
    path: 'bar.fixture.js',
    minifiedSize: 1000,
    gzippedSize: 100,
    diff: {
      empty: false,
      exceedsThreshold: false,

      minified: { delta: 0, percent: '0%' },
      gzip: { delta: 0, percent: '0%' },
    },
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
    diff: {
      empty: false,
      exceedsThreshold: true,

      minified: { delta: 1000, percent: '100%' },
      gzip: { delta: 100, percent: '100%' },
    },
    assetsDiff: {
      css: { minified: { delta: 300, percent: '100%' }, gzip: { delta: 30, percent: '100%' } },
      js: { minified: { delta: 700, percent: '100%' }, gzip: { delta: 70, percent: '100%' } },
    },
  },
];
