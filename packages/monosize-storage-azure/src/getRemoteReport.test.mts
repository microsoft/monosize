const fetch = jest.fn();
jest.mock('node-fetch', () => fetch);

import type { Response } from 'node-fetch';

import { createGetRemoteReport } from './getRemoteReport.mjs';
import type { AzureStorageConfig } from './types.mjs';
import { sampleReport } from './__fixture__/sampleReports.mjs';

const testConfig: AzureStorageConfig = {
  endpoint: 'https://localhost',
};

function noop() {
  /* does nothing */
}

describe('getRemoteReport', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('fetches a remote report', async () => {
    const value: Partial<Response> = {
      json: () => {
        return Promise.resolve(sampleReport);
      },
    };
    fetch.mockImplementation(() => Promise.resolve(value));

    const getRemoteReport = createGetRemoteReport(testConfig);
    const { remoteReport } = await getRemoteReport('main');

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(remoteReport).toEqual(sampleReport);
  });

  it('retries to fetch a report', async () => {
    const value: Partial<Response> = {
      json: () => {
        return Promise.resolve(sampleReport);
      },
    };
    fetch
      .mockImplementationOnce(() => Promise.reject(new Error('A fetch error')))
      .mockImplementationOnce(() => Promise.reject(new Error('A fetch error')))
      .mockImplementation(() => Promise.resolve(value));

    jest.spyOn(console, 'log').mockImplementation(noop);

    const getRemoteReport = createGetRemoteReport(testConfig);
    const { remoteReport } = await getRemoteReport('main');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(remoteReport).toEqual(sampleReport);
  });
});
