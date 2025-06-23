import { describe, expect, it, vitest } from 'vitest';

import { sampleReport } from '../__fixture__/sampleReport.mjs';
import { sampleComparedReport, reportWithExceededThreshold } from '../__fixture__/sampleComparedReport.mjs';
import api, { CompareReportsOptions } from './compareReports.mjs';

const getRemoteReport = vitest.hoisted(() => vitest.fn());
const cliReporter = vitest.hoisted(() => vitest.fn());
const collectLocalReport = vitest.hoisted(() => vitest.fn());
const compareResultsInReports = vitest.hoisted(() => vitest.fn());

vitest.mock('../utils/readConfig.mts', () => ({
  readConfig: vitest.fn().mockResolvedValue({
    storage: { getRemoteReport },
  }),
}));
vitest.mock('../reporters/cliReporter.mts', () => ({ cliReporter }));
vitest.mock('../utils/collectLocalReport.mts', () => ({ collectLocalReport }));
vitest.mock('../utils/compareResultsInReports.mts', () => ({ emptyDiff: {}, compareResultsInReports }));

const DEFAULT_THRESHOLD = { size: 10, type: 'percent' };

describe('compareReports', () => {
  it('fetches remote report and compares it with a local data', async () => {
    const branchName = 'master';

    getRemoteReport.mockResolvedValue({ commitSHA: 'test', remoteReport: sampleReport });
    collectLocalReport.mockImplementation(() => sampleReport);
    compareResultsInReports.mockImplementation(() => sampleComparedReport);

    const options: CompareReportsOptions = { quiet: true, branch: branchName, output: 'cli', deltaFormat: 'percent' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    expect(getRemoteReport).toHaveBeenCalledWith(branchName);
    expect(compareResultsInReports).toHaveBeenCalledWith(sampleReport, sampleReport, DEFAULT_THRESHOLD);
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
});
