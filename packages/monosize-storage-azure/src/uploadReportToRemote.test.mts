import { beforeEach, beforeAll, describe, expect, it, vitest, type Mock } from 'vitest';
import {
  createRowKey,
  ENTRIES_PER_CHUNK,
  splitArrayToChunks,
  createUploadReportToRemote,
} from './uploadReportToRemote.mjs';

import { sampleReport, bigReport } from './__fixture__/sampleReports.mjs';
import { BundleSizeReportEntry } from 'monosize';
import type { AzureStorageConfig } from './types.mjs';

const getRemoteReport = vitest.hoisted(
  () => vitest.fn() as Mock<Array<BundleSizeReportEntry & { partitionKey: string; rowKey: string }>>,
);
const submitTransaction = vitest.hoisted(() => vitest.fn());

const testConfig: AzureStorageConfig = {
  endpoint: 'https://localhost',
  authType: 'AzureNamedKeyCredential',
};

vitest.mock('@azure/data-tables', async () => {
  const listEntities = () => {
    const data = getRemoteReport();

    return {
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          const value = data.shift();

          return {
            value,
            done: value === undefined,
          };
        },
      }),
    };
  };

  const AzureNamedKeyCredential = vitest.fn() as unknown as import('@azure/data-tables').AzureNamedKeyCredential;
  const TableClient = vitest.fn().mockImplementation(() => ({
    listEntities,
    submitTransaction,
  })) as unknown as import('@azure/data-tables').TableClient;

  const azureTables = await vitest.importActual<typeof import('@azure/data-tables')>('@azure/data-tables');
  return {
    ...azureTables,

    AzureNamedKeyCredential,
    TableClient,
  };
});

const commitSHA = 'commit-sha';
const branchName = 'main';

describe('createRowKey', () => {
  it('creates a row key', () => {
    expect(createRowKey(sampleReport[0])).toBe('@scope/foo-packagefoo');
  });
});

describe('splitArrayToChunks', () => {
  it('splits an array to chunks', () => {
    expect(splitArrayToChunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('uploadReportToRemote', () => {
  beforeEach(() => {
    vitest.clearAllMocks();
  });

  beforeAll(() => {
    Object.assign(process.env, {
      BUNDLESIZE_ACCOUNT_KEY: 'account-key',
      BUNDLESIZE_ACCOUNT_NAME: 'account-name',
    });
  });

  it('uploads a report to the remote', async () => {
    // Remote report contains 2 entries, local report contains 1 entry
    // => 1 entry should be deleted, 1 entry should be upserted

    const remoteReport = sampleReport.map(entry => ({
      ...entry,

      partitionKey: 'main',
      rowKey: createRowKey(entry),
    }));
    const localReport = sampleReport.slice(0, 1);

    getRemoteReport.mockReturnValueOnce(remoteReport);
    const uploadReportToRemote = createUploadReportToRemote(testConfig);
    await uploadReportToRemote(branchName, commitSHA, localReport);

    expect(submitTransaction).toHaveBeenCalledTimes(1);
    expect(submitTransaction).toHaveBeenCalledWith([
      ['delete', { partitionKey: 'main', rowKey: createRowKey(sampleReport[1]) }],
      [
        'upsert',
        { ...sampleReport[0], commitSHA, partitionKey: 'main', rowKey: createRowKey(sampleReport[0]) },
        'Replace',
      ],
    ]);
  });

  it('performs chunked transactions if local report is too big', async () => {
    const remoteReport = bigReport.slice(0, 1).map(entry => ({
      ...entry,

      partitionKey: 'main',
      rowKey: createRowKey(entry),
    }));
    const localReport = bigReport;

    getRemoteReport.mockReturnValueOnce(remoteReport);
    const uploadReportToRemote = createUploadReportToRemote(testConfig);
    await uploadReportToRemote(branchName, commitSHA, localReport);

    expect(submitTransaction).toHaveBeenCalledTimes(Math.ceil(localReport.length / ENTRIES_PER_CHUNK));
    expect(submitTransaction).toHaveBeenCalledWith(
      bigReport
        .slice(0, ENTRIES_PER_CHUNK)
        .map(entry => [
          'upsert',
          { ...entry, commitSHA, partitionKey: 'main', rowKey: createRowKey(entry) },
          'Replace',
        ]),
    );
  });

  it('performs no actions if local report is empty', async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const log = vitest.spyOn(console, 'log').mockImplementation(() => {});
    const uploadReportToRemote = createUploadReportToRemote(testConfig);
    await uploadReportToRemote(branchName, commitSHA, []);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('No entries to upload'));

    expect(submitTransaction).not.toHaveBeenCalled();
  });

  it('throws an error if branch contains invalid characters', async () => {
    const uploadReportToRemote = createUploadReportToRemote(testConfig);

    // Test with invalid branch names
    const invalidBranches = ['feature/new-1', 'feature\\new-2', 'refs/heads/feature/new-3'];

    for (const invalidBranch of invalidBranches) {
      await expect(uploadReportToRemote(invalidBranch, commitSHA, sampleReport)).rejects.toThrow(
        `monosize-storage-azure: invalid branch name "${invalidBranch}". Branch names cannot contain forward (/) or backward (\\) slashes.`,
      );
    }
  });
});
