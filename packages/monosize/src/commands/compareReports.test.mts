import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { sampleReport } from '../__fixtures__/sampleReport.mjs';
import { sampleComparedReport, reportWithExceededThreshold } from '../__fixtures__/sampleComparedReport.mjs';
import api, { buildThresholdResolver, CompareReportsOptions, DEFAULT_THRESHOLD } from './compareReports.mjs';

const getRemoteReport = vitest.hoisted(() => vitest.fn());
const cliReporter = vitest.hoisted(() => vitest.fn());
const collectLocalReport = vitest.hoisted(() => vitest.fn());
const compareResultsInReports = vitest.hoisted(() => vitest.fn());

const readConfig = vitest.hoisted(() =>
  vitest.fn().mockResolvedValue({
    storage: { getRemoteReport },
  }),
);

vitest.mock('../utils/readConfig.mts', () => ({ readConfig }));
vitest.mock('../reporters/cliReporter.mts', () => ({ cliReporter }));
vitest.mock('../utils/collectLocalReport.mts', () => ({ collectLocalReport }));
vitest.mock('../utils/compareResultsInReports.mts', () => ({ emptyDiff: {}, compareResultsInReports }));

describe('compareReports', () => {
  beforeEach(() => {
    vitest.clearAllMocks();
    // Restore default readConfig mock after tests that override it
    readConfig.mockResolvedValue({ storage: { getRemoteReport } });
  });

  it('fetches remote report and compares it with a local data', async () => {
    const branchName = 'master';

    getRemoteReport.mockResolvedValue({ commitSHA: 'test', remoteReport: sampleReport });
    collectLocalReport.mockImplementation(() => sampleReport);
    compareResultsInReports.mockImplementation(() => sampleComparedReport);

    const options: CompareReportsOptions = { quiet: true, branch: branchName, output: 'cli', deltaFormat: 'percent' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    expect(getRemoteReport).toHaveBeenCalledWith(branchName);
    expect(compareResultsInReports).toHaveBeenCalledWith(sampleReport, sampleReport, expect.any(Function));
    expect(cliReporter).toHaveBeenCalledWith(sampleComparedReport, {
      commitSHA: 'test',
      deltaFormat: 'percent',
      repository: undefined,
      showUnchanged: false,
    });
  });

  it('exits with a non-zero code if there are entries exceeding the threshold', async () => {
    const branchName = 'master';
    const mockExit = vitest.spyOn(process, 'exit').mockImplementation((() => {
      // do nothing
    }) as () => never);

    getRemoteReport.mockResolvedValue({ commitSHA: 'test', remoteReport: sampleReport });
    collectLocalReport.mockImplementation(() => sampleReport);
    compareResultsInReports.mockImplementation(() => reportWithExceededThreshold);

    const options: CompareReportsOptions = { quiet: true, branch: branchName, output: 'cli', deltaFormat: 'percent' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    expect(cliReporter).toHaveBeenCalledWith(reportWithExceededThreshold, expect.any(Object));
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it('passes a per-package threshold resolver when config.threshold is a Record', async () => {
    const branchName = 'master';

    readConfig.mockResolvedValue({
      storage: { getRemoteReport },
      threshold: { 'foo-package': '5%', 'bar-package': '1kB' },
    });
    getRemoteReport.mockResolvedValue({ commitSHA: 'test', remoteReport: sampleReport });
    collectLocalReport.mockImplementation(() => sampleReport);
    compareResultsInReports.mockImplementation(() => sampleComparedReport);

    const options: CompareReportsOptions = { quiet: true, branch: branchName, output: 'cli', deltaFormat: 'percent' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    expect(compareResultsInReports).toHaveBeenCalledWith(sampleReport, sampleReport, expect.any(Function));
    const resolver = compareResultsInReports.mock.lastCall![2] as (pkg: string) => unknown;
    expect(resolver('foo-package')).toEqual({ size: 5, type: 'percent' });
    expect(resolver('bar-package')).toEqual({ size: 1024, type: 'size' });
  });

  it('falls back to DEFAULT_THRESHOLD for packages not listed in the Record', async () => {
    readConfig.mockResolvedValue({
      storage: { getRemoteReport },
      threshold: { 'foo-package': '5%' },
    });
    getRemoteReport.mockResolvedValue({ commitSHA: 'test', remoteReport: sampleReport });
    collectLocalReport.mockImplementation(() => sampleReport);
    compareResultsInReports.mockImplementation(() => sampleComparedReport);

    const options: CompareReportsOptions = { quiet: true, branch: 'master', output: 'cli', deltaFormat: 'percent' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    const resolver = compareResultsInReports.mock.lastCall![2] as (pkg: string) => unknown;
    // 'baz-package' is not in the record → should return the parsed DEFAULT_THRESHOLD
    expect(resolver('baz-package')).toEqual({ size: 10, type: 'percent' });
  });
});

describe('buildThresholdResolver', () => {
  it('returns a constant resolver for a plain string threshold', () => {
    const resolver = buildThresholdResolver('5%');
    expect(resolver('any-package')).toEqual({ size: 5, type: 'percent' });
    expect(resolver('other-package')).toEqual({ size: 5, type: 'percent' });
  });

  it('returns a constant resolver for undefined (uses DEFAULT_THRESHOLD)', () => {
    const resolver = buildThresholdResolver(undefined);
    expect(resolver('any-package')).toEqual({ size: 10, type: 'percent' });
  });

  it('returns per-package resolver for a Record threshold', () => {
    const resolver = buildThresholdResolver({ 'pkg-a': '1kB', 'pkg-b': '20%' });
    expect(resolver('pkg-a')).toEqual({ size: 1024, type: 'size' });
    expect(resolver('pkg-b')).toEqual({ size: 20, type: 'percent' });
  });

  it('falls back to DEFAULT_THRESHOLD for packages not in the Record', () => {
    const resolver = buildThresholdResolver({ 'pkg-a': '1kB' });
    expect(resolver('unknown-package')).toEqual({ size: 10, type: 'percent' });
  });

  it('allows mixing root and per-package when only a subset is listed', () => {
    const resolver = buildThresholdResolver({ 'special-pkg': '50%' });
    // Listed package gets its own threshold
    expect(resolver('special-pkg')).toEqual({ size: 50, type: 'percent' });
    // Unlisted package gets the default
    expect(resolver('regular-pkg')).toEqual({ size: 10, type: 'percent' });
  });
});

// Re-export DEFAULT_THRESHOLD coverage
describe('DEFAULT_THRESHOLD', () => {
  it('is "10%"', () => {
    expect(DEFAULT_THRESHOLD).toBe('10%');
  });
});
