import { AzureNamedKeyCredential, odata, TableClient, TableTransaction } from '@azure/data-tables';
import { AzurePipelinesCredential } from '@azure/identity';
import { BundleSizeReportEntry, BundleSizeReport, StorageAdapter } from 'monosize';
import pc from 'picocolors';
import type { AzureAuthenticationType, AzureStorageConfig } from './types.mjs';

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
  const { authType = 'AzureNamedKeyCredential' } = config;

  async function uploadReportToRemote(
    branch: string,
    commitSHA: string,
    localReport: BundleSizeReport,
  ): ReturnType<StorageAdapter['uploadReportToRemote']> {
    const client = getTableClient(authType);

    if (localReport.length === 0) {
      console.log([pc.yellow('[w]'), 'No entries to upload'].join(' '));
      return;
    }

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
  }

  return uploadReportToRemote;
}

function getTableClient(authType: AzureAuthenticationType): TableClient {
  if (typeof process.env['BUNDLESIZE_ACCOUNT_NAME'] !== 'string') {
    throw new Error('monosize-storage-azure: "BUNDLESIZE_ACCOUNT_NAME" is not defined in your process.env');
  }
  const AZURE_STORAGE_ACCOUNT = process.env['BUNDLESIZE_ACCOUNT_NAME'];
  const AZURE_STORAGE_TABLE_NAME = 'latest';

  if (authType === 'AzurePipelinesCredential') {
    if (typeof process.env['AZURE_TENANT_ID'] !== 'string') {
      throw new Error('monosize-storage-azure: "AZURE_TENANT_ID" is not defined in your process.env');
    }
    if (typeof process.env['AZURE_CLIENT_ID'] !== 'string') {
      throw new Error('monosize-storage-azure: "AZURE_CLIENT_ID" is not defined in your process.env');
    }
    if (typeof process.env['AZURE_SERVICE_CONNECTION_ID'] !== 'string') {
      throw new Error('monosize-storage-azure: "AZURE_SERVICE_CONNECTION_ID" is not defined in your process.env');
    }
    if (typeof process.env['SYSTEM_ACCESSTOKEN'] !== 'string') {
      throw new Error('monosize-storage-azure: "SYSTEM_ACCESSTOKEN" is not defined in your process.env');
    }
    const tenantId = process.env['AZURE_TENANT_ID'];
    const clientId = process.env['AZURE_CLIENT_ID'];
    const serviceConnectionId = process.env['AZURE_SERVICE_CONNECTION_ID'];
    const systemAccessToken = process.env['SYSTEM_ACCESSTOKEN'];

    return new TableClient(
      `https://${AZURE_STORAGE_ACCOUNT}.table.core.windows.net`,
      AZURE_STORAGE_TABLE_NAME,
      new AzurePipelinesCredential(tenantId, clientId, serviceConnectionId, systemAccessToken),
    );
  } else {
    /**
     * Defaults to AzureNamedKeyCredential
     */
    if (typeof process.env['BUNDLESIZE_ACCOUNT_KEY'] !== 'string') {
      throw new Error('monosize-storage-azure: "BUNDLESIZE_ACCOUNT_KEY" is not defined in your process.env');
    }

    const AZURE_ACCOUNT_KEY = process.env['BUNDLESIZE_ACCOUNT_KEY'];

    return new TableClient(
      `https://${AZURE_STORAGE_ACCOUNT}.table.core.windows.net`,
      AZURE_STORAGE_TABLE_NAME,
      new AzureNamedKeyCredential(AZURE_STORAGE_ACCOUNT, AZURE_ACCOUNT_KEY),
    );
  }
}
