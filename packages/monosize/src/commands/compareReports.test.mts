import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { sampleReport } from '../__fixtures__/sampleReport.mjs';
import { sampleComparedReport, reportWithExceededThreshold } from '../__fixtures__/sampleComparedReport.mjs';
import api, { CompareReportsOptions, DEFAULT_THRESHOLD } from './compareReports.mjs';

const getRemoteReport = vitest.hoisted(() => vitest.fn());
const cliReporter = vitest.hoisted(() => vitest.fn());
const collectLocalReport = vitest.hoisted(() => vitest.fn());
const buildPackageThresholdResolver = vitest.hoisted(() => vitest.fn());
const compareResultsInReports = vitest.hoisted(() => vitest.fn());

const readConfig = vitest.hoisted(() =>
  vitest.fn().mockResolvedValue({
    storage: { getRemoteReport },
  }),
);

vitest.mock('../utils/readConfig.mts', () => ({ readConfig }));
vitest.mock('../reporters/cliReporter.mts', () => ({ cliReporter }));
vitest.mock('../utils/collectLocalReport.mts', () => ({ collectLocalReport, buildPackageThresholdResolver }));
vitest.mock('../utils/compareResultsInReports.mts', () => ({ emptyDiff: {}, compareResultsInReports }));

const DEFAULT_THRESHOLD_VALUE = { size: 10, type: 'percent' };

describe('compareReports', () => {
  beforeEach(() => {
    vitest.clearAllMocks();
    readConfig.mockResolvedValue({ storage: { getRemoteReport } });
    // Default: return a constant resolver that returns DEFAULT_THRESHOLD
    buildPackageThresholdResolver.mockResolvedValue(() => DEFAULT_THRESHOLD_VALUE);
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

  it('builds threshold resolver with root threshold as fallback', async () => {
    const branchName = 'master';

    readConfig.mockResolvedValue({ storage: { getRemoteReport }, threshold: '5%' });
    getRemoteReport.mockResolvedValue({ commitSHA: 'test', remoteReport: sampleReport });
    collectLocalReport.mockImplementation(() => sampleReport);
    compareResultsInReports.mockImplementation(() => sampleComparedReport);

    const options: CompareReportsOptions = { quiet: true, branch: branchName, output: 'cli', deltaFormat: 'percent' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    expect(buildPackageThresholdResolver).toHaveBeenCalledWith(
      expect.objectContaining({ threshold: '5%' }),
      { size: 5, type: 'percent' },
    );
  });

  it('uses DEFAULT_THRESHOLD as fallback when no threshold configured', async () => {
    const branchName = 'master';

    getRemoteReport.mockResolvedValue({ commitSHA: 'test', remoteReport: sampleReport });
    collectLocalReport.mockImplementation(() => sampleReport);
    compareResultsInReports.mockImplementation(() => sampleComparedReport);

    const options: CompareReportsOptions = { quiet: true, branch: branchName, output: 'cli', deltaFormat: 'percent' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    expect(buildPackageThresholdResolver).toHaveBeenCalledWith(
      expect.objectContaining({}),
      { size: 10, type: 'percent' },
    );
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
});

describe('DEFAULT_THRESHOLD', () => {
  it('is "10%"', () => {
    expect(DEFAULT_THRESHOLD).toBe('10%');
  });
});

