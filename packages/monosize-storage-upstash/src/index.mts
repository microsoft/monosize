import { Redis } from '@upstash/redis';
import type { BundleSizeReport, StorageAdapter } from 'monosize';

type UpstashStorageConfig = {
  url: string;
  readonlyToken: string;
};

function createUpstashStorage(config: UpstashStorageConfig): StorageAdapter {
  const getRemoteReport: StorageAdapter['getRemoteReport'] = async (branch: string) => {
    const redis = new Redis({
      url: config.url,
      token: config.readonlyToken,
    });

    const result = await redis.get<{ commitSHA: string; data: BundleSizeReport } | null>(branch);

    if (result === null) {
      throw new Error('monosize-storage-upstash: Failed to get data from a remote host');
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
      throw new Error('monosize-storage-upstash: "UPSTASH_WRITE_TOKEN" is not defined in your process.env');
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

export default createUpstashStorage;
