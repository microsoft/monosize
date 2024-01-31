import fetch from 'node-fetch';
import pc from 'picocolors';
import type { BundleSizeReportEntry, StorageAdapter } from 'monosize';

import type { AzureStorageConfig } from './types.mjs';

const MAX_HTTP_ATTEMPT_COUNT = 5;

export function createGetRemoteReport(config: AzureStorageConfig) {
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

  return getRemoteReport;
}
