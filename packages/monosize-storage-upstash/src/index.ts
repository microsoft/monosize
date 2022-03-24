import { Redis } from '@upstash/redis';
import type { BundleSizeReport, StorageAdapter } from 'monosize';

type UpstashStorageConfig = {
  url: string;
  readonlyToken: string;
};

export default function createUpstashStorage(config: UpstashStorageConfig): StorageAdapter {
  const getRemoteReport: StorageAdapter['getRemoteReport'] = async (branch: string) => {
    const redis = new Redis({
      url: config.url,
      token: config.readonlyToken,
    });

    const result = await redis.get<{ commitSHA: string; data: BundleSizeReport } | null>(branch);

    if (result === null) {
      throw new Error(/* TODO */);
    }

    // TODO: validate data with schema
    // TODO: repeat queries

    return {
      commitSHA: result.commitSHA,
      remoteReport: result.data,
    };
  };

  const uploadReportToRemote: StorageAdapter['uploadReportToRemote'] = async (branch, commitSHA, localReport) => {
    if (typeof process.env['UPSTASH_WRITE_TOKEN'] !== 'string') {
      throw new Error(/* TODO */);
    }

    const redis = new Redis({
      url: config.url,
      token: process.env['UPSTASH_WRITE_TOKEN'],
    });
    const data = JSON.stringify({
      commitSHA,
      data: localReport,
    });

    // TODO: repeat queries
    await redis.set(branch, data);
  };

  return {
    getRemoteReport,
    uploadReportToRemote,
  };
}
