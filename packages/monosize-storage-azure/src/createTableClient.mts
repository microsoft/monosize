import { AzureNamedKeyCredential, TableClient } from '@azure/data-tables';
import { AzurePipelinesCredential } from '@azure/identity';
import type { AzureStorageConfig } from './types.mjs';

export function createTableClient(authType: NonNullable<AzureStorageConfig['authType']>): TableClient {
  const AZURE_STORAGE_ACCOUNT = getEnvValueOrThrow('BUNDLESIZE_ACCOUNT_NAME');
  const AZURE_STORAGE_TABLE_NAME = 'latest';

  if (authType === 'AzurePipelinesCredential') {
    const tenantId = getEnvValueOrThrow('AZURE_TENANT_ID');
    const clientId = getEnvValueOrThrow('AZURE_CLIENT_ID');
    const serviceConnectionId = getEnvValueOrThrow('AZURE_SERVICE_CONNECTION_ID');
    const systemAccessToken = getEnvValueOrThrow('SYSTEM_ACCESSTOKEN');

    return new TableClient(
      `https://${AZURE_STORAGE_ACCOUNT}.table.core.windows.net`,
      AZURE_STORAGE_TABLE_NAME,
      new AzurePipelinesCredential(tenantId, clientId, serviceConnectionId, systemAccessToken),
    );
  } else {
    /**
     * Defaults to AzureNamedKeyCredential
     */

    const AZURE_ACCOUNT_KEY = getEnvValueOrThrow('BUNDLESIZE_ACCOUNT_KEY');

    return new TableClient(
      `https://${AZURE_STORAGE_ACCOUNT}.table.core.windows.net`,
      AZURE_STORAGE_TABLE_NAME,
      new AzureNamedKeyCredential(AZURE_STORAGE_ACCOUNT, AZURE_ACCOUNT_KEY),
    );
  }
}

function getEnvValueOrThrow(envParamName: string): string {
  if (typeof process.env[envParamName] !== 'string') {
    throw new Error(`monosize-storage-azure: ${envParamName} is not defined in your process.env`);
  }

  return process.env[envParamName];
}
