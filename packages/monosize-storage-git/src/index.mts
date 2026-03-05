import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { BundleSizeReport, StorageAdapter } from 'monosize';

export type GitStorageConfig = {
  /**
   * Path to the report file in the repository, relative to the git root.
   * This file will be read from the target branch via `git show` and written to disk on upload.
   */
  reportPath: string;
};

type StoredReport = {
  commitSHA: string;
  data: BundleSizeReport;
};

function createGitStorage(config: GitStorageConfig): StorageAdapter {
  const getRemoteReport: StorageAdapter['getRemoteReport'] = async (branch: string) => {
    let commitSHA: string;

    try {
      commitSHA = execSync(`git rev-parse ${branch}`, { encoding: 'utf-8' }).trim();
    } catch {
      return { commitSHA: '', remoteReport: [] };
    }

    let fileContent: string;

    try {
      fileContent = execSync(`git show ${branch}:${config.reportPath}`, { encoding: 'utf-8' });
    } catch {
      return { commitSHA, remoteReport: [] };
    }

    const result: StoredReport = JSON.parse(fileContent);

    return {
      commitSHA: result.commitSHA,
      remoteReport: result.data,
    };
  };

  const uploadReportToRemote: StorageAdapter['uploadReportToRemote'] = async (
    _branch,
    commitSHA,
    localReport,
  ) => {
    const reportDir = path.dirname(config.reportPath);

    if (reportDir !== '.') {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const data: StoredReport = { commitSHA, data: localReport };

    fs.writeFileSync(config.reportPath, JSON.stringify(data, null, 2));
  };

  return {
    getRemoteReport,
    uploadReportToRemote,
  };
}

export default createGitStorage;
