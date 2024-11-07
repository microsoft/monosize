import { AzureNamedKeyCredential, TableClient } from '@azure/data-tables';
import { AzurePipelinesCredential, DefaultAzureCredential } from '@azure/identity';
import type { AzureStorageConfig } from './types.mjs';

export function createTableClient(options: Required<Pick<AzureStorageConfig, 'authType' | 'tableName'>>): TableClient {
  const { authType, tableName } = options;

  const AZURE_STORAGE_TABLE_NAME = tableName;

  if (authType === 'AzureNamedKeyCredential') {
    const requiredEnvVars = ['BUNDLESIZE_ACCOUNT_NAME', 'BUNDLESIZE_ACCOUNT_KEY'];
    validateRequiredEnvVariables({
      requiredEnvVars,
      authType,
    });

    const AZURE_STORAGE_ACCOUNT = process.env['BUNDLESIZE_ACCOUNT_NAME'] as string;
    const AZURE_ACCOUNT_KEY = process.env['BUNDLESIZE_ACCOUNT_KEY'] as string;

    return new TableClient(
      `https://${AZURE_STORAGE_ACCOUNT}.table.core.windows.net`,
      AZURE_STORAGE_TABLE_NAME,
      new AzureNamedKeyCredential(AZURE_STORAGE_ACCOUNT, AZURE_ACCOUNT_KEY),
    );
  }

  if (authType === 'AzurePipelinesCredential') {
    const requiredEnvVars = [
      'BUNDLESIZE_ACCOUNT_NAME',
      'AZURE_TENANT_ID',
      'AZURE_CLIENT_ID',
      'AZURE_SERVICE_CONNECTION_ID',
      'SYSTEM_ACCESSTOKEN',
    ];
    validateRequiredEnvVariables({
      requiredEnvVars,
      authType,
    });

    const AZURE_STORAGE_ACCOUNT = process.env['BUNDLESIZE_ACCOUNT_NAME'] as string;
    const TENANT_ID = process.env['AZURE_TENANT_ID'] as string;
    const CLIENT_ID = process.env['AZURE_CLIENT_ID'] as string;
    const SERVICE_CONNECTION_ID = process.env['AZURE_SERVICE_CONNECTION_ID'] as string;
    const SYSTEM_ACCESSTOKEN = process.env['SYSTEM_ACCESSTOKEN'] as string;

    return new TableClient(
      `https://${AZURE_STORAGE_ACCOUNT}.table.core.windows.net`,
      AZURE_STORAGE_TABLE_NAME,
      new AzurePipelinesCredential(TENANT_ID, CLIENT_ID, SERVICE_CONNECTION_ID, SYSTEM_ACCESSTOKEN),
    );
  }

  if (authType === 'DefaultAzureCredential') {
    // DefaultAzureCredential will obtain these from environment variables, thus why we need to assert on them while they are not used directly in code
    const requiredEnvVars = [
      'BUNDLESIZE_ACCOUNT_NAME',
      'AZURE_TENANT_ID',
      'AZURE_CLIENT_ID',
      'AZURE_SERVICE_CONNECTION_ID',
    ];
    validateRequiredEnvVariables({
      requiredEnvVars,
      authType,
    });

    const AZURE_STORAGE_ACCOUNT = process.env['BUNDLESIZE_ACCOUNT_NAME'] as string;
    const TENANT_ID = process.env['AZURE_TENANT_ID'] as string;

    return new TableClient(
      `https://${AZURE_STORAGE_ACCOUNT}.table.core.windows.net`,
      AZURE_STORAGE_TABLE_NAME,
      new DefaultAzureCredential({ tenantId: TENANT_ID }),
    );
  }

  throw new Error(`monosize-storage-azure: "authType: ${authType}" is not supported.`);
}

function validateRequiredEnvVariables(options: { requiredEnvVars: string[]; authType: string }): void {
  const { requiredEnvVars, authType } = options;
  const missingEnvVars = requiredEnvVars.filter(envParamName => typeof process.env[envParamName] !== 'string');

  if (missingEnvVars.length > 0) {
    throw new Error(
      `monosize-storage-azure: Missing required environment variable(s) for authType ${authType}: ${missingEnvVars.join(
        ', ',
      )} not in your process.env.`,
    );
  }
}
