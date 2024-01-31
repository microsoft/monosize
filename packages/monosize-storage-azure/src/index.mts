import type { StorageAdapter } from 'monosize';

import { createGetRemoteReport } from './getRemoteReport.mjs';
import { uploadReportToRemote } from './uploadReportToRemote.mjs';
import type { AzureStorageConfig } from './types.mjs';

function createAzureStorage(config: AzureStorageConfig): StorageAdapter {
  return {
    getRemoteReport: createGetRemoteReport(config),
    uploadReportToRemote,
  };
}

export default createAzureStorage;
