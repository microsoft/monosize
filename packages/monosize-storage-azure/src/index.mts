import { odata, TableClient, AzureNamedKeyCredential, TableTransaction } from '@azure/data-tables';
import fetch from 'node-fetch';
import pc from 'picocolors';
import type { BundleSizeReportEntry, StorageAdapter } from 'monosize';

export type AzureStorageConfig = {
  endpoint: string;
};

const MAX_HTTP_ATTEMPT_COUNT = 5;

function createAzureStorage(config: AzureStorageConfig): StorageAdapter {
  async function getRemoteReport(branch: string, attempt = 1): ReturnType<StorageAdapter['getRemoteReport']> {
    try {
      const response = await fetch(`${config.endpoint}?branch=${branch}`);
      const result = (await response.json()) as Array<BundleSizeReportEntry & { commitSHA: string }>;

      const remoteReport = result.map(entity => {
        const { commitSHA, ...rest } = entity;
        return rest;
      });
      const { commitSHA } = result[result.length - 1];

      return { commitSHA, remoteReport };
    } catch (err) {
      console.log([pc.yellow('[w]'), (err as Error).toString()].join(' '));
      console.log([pc.yellow('[w]'), 'Failed to fetch report from the remote. Retrying...'].join(' '));

      if (attempt >= MAX_HTTP_ATTEMPT_COUNT) {
        console.error(
          [pc.red('[e]'), 'Exceeded 5 attempts to fetch reports, please check previously reported warnings...'].join(
            ' ',
          ),
        );
        throw err;
      }

      return getRemoteReport(branch, attempt + 1);
    }
  }

  const uploadReportToRemote: StorageAdapter['uploadReportToRemote'] = async (branch, commitSHA, localReport) => {
    if (typeof process.env['BUNDLESIZE_ACCOUNT_KEY'] !== 'string') {
      throw new Error('monosize-storage-azure: "BUNDLESIZE_ACCOUNT_KEY" is not defined in your process.env');
    }

    if (typeof process.env['BUNDLESIZE_ACCOUNT_NAME'] !== 'string') {
      throw new Error('monosize-storage-azure: "BUNDLESIZE_ACCOUNT_NAME" is not defined in your process.env');
    }

    const AZURE_STORAGE_ACCOUNT = process.env['BUNDLESIZE_ACCOUNT_NAME'];
    const AZURE_STORAGE_TABLE_NAME = 'latest';
    const AZURE_ACCOUNT_KEY = process.env['BUNDLESIZE_ACCOUNT_KEY'];

    const credentials = new AzureNamedKeyCredential(AZURE_STORAGE_ACCOUNT, AZURE_ACCOUNT_KEY);
    const client = new TableClient(
      `https://${AZURE_STORAGE_ACCOUNT}.table.core.windows.net`,
      AZURE_STORAGE_TABLE_NAME,
      credentials,
    );

    const transaction = new TableTransaction();
    const entitiesIterator = await client.listEntities({
      queryOptions: {
        filter: odata`PartitionKey eq ${branch}`,
      },
    });

    function createRowKey(entry: BundleSizeReportEntry): string {
      // Azure does not support slashes in "rowKey"
      // https://docs.microsoft.com/archive/blogs/jmstall/azure-storage-naming-rules
      return `${entry.packageName}${entry.path.replace(/\.fixture\.js$/, '').replace(/\//g, '')}`;
    }

    for await (const entity of entitiesIterator) {
      // We can't delete and create entries with the same "rowKey" in the same transaction
      // => we delete only entries not present in existing report
      const isEntryPresentInExistingReport = Boolean(localReport.find(entry => createRowKey(entry) === entity.rowKey));
      const shouldEntryBeDeleted = !isEntryPresentInExistingReport;

      if (shouldEntryBeDeleted) {
        transaction.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
      }
    }

    if (localReport.length === 0) {
      console.log([pc.yellow('[w]'), 'No entries to upload'].join(' '));
      return;
    }

    localReport.forEach(entry => {
      transaction.upsertEntity(
        {
          partitionKey: branch,
          rowKey: createRowKey(entry),

          name: entry.name,
          packageName: entry.packageName,
          path: entry.path,

          minifiedSize: entry.minifiedSize,
          gzippedSize: entry.gzippedSize,

          commitSHA,
        },
        'Replace',
      );
    });

    await client.submitTransaction(transaction.actions);
  };

  return {
    getRemoteReport,
    uploadReportToRemote,
  };
}

export default createAzureStorage;
