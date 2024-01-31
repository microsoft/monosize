import { AzureNamedKeyCredential, odata, TableClient, TableTransaction } from '@azure/data-tables';
import { BundleSizeReportEntry, StorageAdapter } from 'monosize';
import pc from 'picocolors';

export const ENTRIES_PER_CHUNK = 90;

export function createRowKey(entry: BundleSizeReportEntry): string {
  // Azure does not support slashes in "rowKey"
  // https://docs.microsoft.com/archive/blogs/jmstall/azure-storage-naming-rules
  return `${entry.packageName}${entry.path.replace(/\.fixture\.js$/, '').replace(/\//g, '')}`;
}

export function splitArrayToChunks<T>(arr: T[], size: number): T[][] {
  return [...Array(Math.ceil(arr.length / size))].map((_, i) => arr.slice(i * size, (i + 1) * size));
}

export const uploadReportToRemote: StorageAdapter['uploadReportToRemote'] = async (branch, commitSHA, localReport) => {
  if (typeof process.env['BUNDLESIZE_ACCOUNT_KEY'] !== 'string') {
    throw new Error('monosize-storage-azure: "BUNDLESIZE_ACCOUNT_KEY" is not defined in your process.env');
  }

  if (typeof process.env['BUNDLESIZE_ACCOUNT_NAME'] !== 'string') {
    throw new Error('monosize-storage-azure: "BUNDLESIZE_ACCOUNT_NAME" is not defined in your process.env');
  }

  if (localReport.length === 0) {
    console.log([pc.yellow('[w]'), 'No entries to upload'].join(' '));
    return;
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
};
