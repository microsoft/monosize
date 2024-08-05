import { describe, expect, it, vitest } from 'vitest';
import { AzureNamedKeyCredential, TableClient } from '@azure/data-tables';
import { AzurePipelinesCredential } from '@azure/identity';
import { createTableClient } from './createTableClient.mjs';
import { beforeEach } from 'node:test';

vitest.mock('@azure/data-tables', () => {
  return {
    AzureNamedKeyCredential: vitest.fn(),
    TableClient: vitest.fn().mockImplementation(() => {
      return {
        createTable: vitest.fn(),
        deleteTable: vitest.fn(),
      };
    }),
  };
});

vitest.mock('@azure/identity', () => {
  return {
    AzurePipelinesCredential: vitest.fn(),
  };
});

describe('createTableClient', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
    vitest.unstubAllEnvs();
  });

  it('should create TableClient with AzureNamedKeyCredential', () => {
    vitest.stubEnv('BUNDLESIZE_ACCOUNT_NAME', 'mock-account-name');
    vitest.stubEnv('BUNDLESIZE_ACCOUNT_KEY', 'mock-account-key');

    const authType = 'AzureNamedKeyCredential';
    createTableClient(authType);

    expect(AzureNamedKeyCredential).toHaveBeenCalledWith(
      process.env['BUNDLESIZE_ACCOUNT_NAME'] as string,
      process.env['BUNDLESIZE_ACCOUNT_KEY'] as string,
    );

    expect(TableClient).toHaveBeenCalledWith(
      'https://mock-account-name.table.core.windows.net',
      'latest',
      expect.any(AzureNamedKeyCredential),
    );
  });

  it('should create TableClient with AzurePipelinesCredential', () => {
    vitest.stubEnv('BUNDLESIZE_ACCOUNT_NAME', 'mock-account-name');
    vitest.stubEnv('AZURE_TENANT_ID', 'mock-tenant-id');
    vitest.stubEnv('AZURE_CLIENT_ID', 'mock-client-id');
    vitest.stubEnv('AZURE_SERVICE_CONNECTION_ID', 'mock-service-connection-id');
    vitest.stubEnv('SYSTEM_ACCESSTOKEN', 'mock-system-access-token');
    vitest.stubEnv('SYSTEM_OIDCREQUESTURI', 'mock-system-oidc-request-uri');

    const authType = 'AzurePipelinesCredential';
    createTableClient(authType);

    expect(AzurePipelinesCredential).toHaveBeenCalledWith(
      process.env['AZURE_TENANT_ID'] as string,
      process.env['AZURE_CLIENT_ID'] as string,
      process.env['AZURE_SERVICE_CONNECTION_ID'] as string,
      process.env['SYSTEM_ACCESSTOKEN'] as string,
    );

    expect(TableClient).toHaveBeenCalledWith(
      'https://mock-account-name.table.core.windows.net',
      'latest',
      expect.any(AzurePipelinesCredential),
    );
  });
});
