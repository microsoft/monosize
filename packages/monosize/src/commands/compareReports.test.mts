const getRemoteReport = jest.fn();
const collectLocalReport = jest.fn();
const compareResultsInReports = jest.fn();
const cliReporter = jest.fn();

jest.mock('../reporters/cliReporter', () => ({ cliReporter }));
jest.mock('../utils/collectLocalReport', () => ({ collectLocalReport }));
jest.mock('../utils/compareResultsInReports', () => ({ compareResultsInReports }));
jest.mock('../utils/readConfig', () => ({ readConfig: () => ({ storage: { getRemoteReport } }) }));

import { sampleReport } from '../__fixture__/sampleReport.mjs';
import { sampleComparedReport } from '../__fixture__/sampleComparedReport.mjs';
import api, { CompareReportsOptions } from './compareReports.mjs';

describe('compareReports', () => {
  it('fetches remote report and compares it with a local data', async () => {
    const branchName = 'master';

    getRemoteReport.mockImplementation(() => ({ commitSHA: 'test', remoteReport: sampleReport }));
    collectLocalReport.mockImplementation(() => sampleReport);
    compareResultsInReports.mockImplementation(() => sampleComparedReport);

    const options: CompareReportsOptions = { quiet: true, branch: branchName, output: 'cli' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await api.handler(options as any);

    expect(getRemoteReport).toHaveBeenCalledWith(branchName);
    expect(compareResultsInReports).toHaveBeenCalledWith(sampleReport, sampleReport);
    expect(cliReporter).toHaveBeenCalledWith(sampleComparedReport);
  });
});
