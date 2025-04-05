import { beforeEach, describe, expect, it, vitest } from 'vitest';

import { createGetRemoteReport } from './getRemoteReport.mjs';
import type { AzureStorageConfig } from './types.mjs';
import { sampleReport } from './__fixture__/sampleReports.mjs';

const fetch = vitest.hoisted(() => vitest.fn());
global.fetch = fetch;

const testConfig: AzureStorageConfig = {
  endpoint: 'https://localhost',
};

function noop() {
  /* does nothing */
}

describe('getRemoteReport', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
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

    vitest.spyOn(console, 'log').mockImplementation(noop);

    const getRemoteReport = createGetRemoteReport(testConfig);
    const { remoteReport } = await getRemoteReport('main');

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(remoteReport).toEqual(sampleReport);
  });
});
