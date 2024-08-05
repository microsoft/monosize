import { odata, TableTransaction } from '@azure/data-tables';
import { BundleSizeReportEntry, BundleSizeReport, StorageAdapter } from 'monosize';
import pc from 'picocolors';
import { createTableClient } from './createTableClient.mjs';
import type { AzureStorageConfig } from './types.mjs';

export const ENTRIES_PER_CHUNK = 90;

export function createRowKey(entry: BundleSizeReportEntry): string {
  // Azure does not support slashes in "rowKey"
  // https://docs.microsoft.com/archive/blogs/jmstall/azure-storage-naming-rules
  return `${entry.packageName}${entry.path.replace(/\.fixture\.js$/, '').replace(/\//g, '')}`;
}

export function splitArrayToChunks<T>(arr: T[], size: number): T[][] {
  return [...Array(Math.ceil(arr.length / size))].map((_, i) => arr.slice(i * size, (i + 1) * size));
}

export function createUploadReportToRemote(config: AzureStorageConfig) {
  const { authType = 'AzureNamedKeyCredential', tableName = 'latest' } = config;

  async function uploadReportToRemote(
    branch: string,
    commitSHA: string,
    localReport: BundleSizeReport,
  ): ReturnType<StorageAdapter['uploadReportToRemote']> {
    const client = createTableClient({ authType, tableName });

    if (localReport.length === 0) {
      console.log([pc.yellow('[w]'), 'No entries to upload'].join(' '));
      return;
    }

    const transaction = new TableTransaction();
    const entitiesIterator = client.listEntities({
      queryOptions: {
        filter: odata`PartitionKey eq ${branch}`,
      },
    });

    for await (const entity of entitiesIterator) {
      // We can't delete and create entries with the same "rowKey" in the same transaction
      // => we delete only entries not present in existing report
      const isEntryPresentInExistingReport = Boolean(localReport.find(entry => createRowKey(entry) === entity.rowKey));
      const shouldEntryBeDeleted = !isEntryPresentInExistingReport;

      if (shouldEntryBeDeleted) {
        transaction.deleteEntity(entity.partitionKey as string, entity.rowKey as string);
      }
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

    const chunks = splitArrayToChunks(transaction.actions, ENTRIES_PER_CHUNK);

    for (const chunk of chunks) {
      await client.submitTransaction(chunk);
    }
  }

  return uploadReportToRemote;
}
