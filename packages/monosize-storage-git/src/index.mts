import { inflateRawSync } from 'node:zlib';

import { Octokit } from '@octokit/rest';
import type { BundleSizeReport, StorageAdapter } from 'monosize';

export type GitStorageConfig = {
  /** GitHub repository owner (org or user). */
  owner: string;
  /** GitHub repository name. */
  repo: string;
  /** Name of the workflow artifact that contains the bundle size report. Defaults to `'monosize-report'`. */
  artifactName?: string;
  /** Workflow filename (e.g. `'ci.yml'`) to search runs from. */
  workflowFileName: string;
};

type StoredReport = {
  commitSHA: string;
  data: BundleSizeReport;
};

const DEFAULT_ARTIFACT_NAME = 'monosize-report';

function createGitStorage(config: GitStorageConfig): StorageAdapter {
  const artifactName = config.artifactName ?? DEFAULT_ARTIFACT_NAME;
  function createOctokit(): Octokit {
    const token = process.env['GITHUB_TOKEN'];

    if (!token) {
      throw new Error(
        'monosize-storage-git: GITHUB_TOKEN environment variable is required. ' +
          'It is available by default in GitHub Actions workflows.',
      );
    }

    return new Octokit({ auth: token });
  }

  const getRemoteReport: StorageAdapter['getRemoteReport'] = async (branch: string) => {
    const octokit = createOctokit();

    const { data: runsData } = await octokit.actions.listWorkflowRuns({
      owner: config.owner,
      repo: config.repo,
      workflow_id: config.workflowFileName,
      branch,
      status: 'completed',
      per_page: 5,
    });

    for (const run of runsData.workflow_runs) {
      const { data: artifactsData } = await octokit.actions.listWorkflowRunArtifacts({
        owner: config.owner,
        repo: config.repo,
        run_id: run.id,
      });

      const artifact = artifactsData.artifacts.find((a) => a.name === artifactName);

      if (!artifact) {
        continue;
      }

      const { data: zipData } = await octokit.actions.downloadArtifact({
        owner: config.owner,
        repo: config.repo,
        artifact_id: artifact.id,
        archive_format: 'zip',
      });

      const zipBuffer = Buffer.from(zipData as ArrayBuffer);
      const entries = parseZip(zipBuffer);

      if (entries.length === 0) {
        continue;
      }

      const report: StoredReport = JSON.parse(entries[0]);

      return {
        commitSHA: report.commitSHA,
        remoteReport: report.data,
      };
    }

    return { commitSHA: '', remoteReport: [] };
  };

  const uploadReportToRemote: StorageAdapter['uploadReportToRemote'] = async () => {
    throw new Error(
      `monosize-storage-git does not support uploading reports directly. ` +
        `Use the 'actions/upload-artifact' GitHub Action to upload your report as an artifact named '${artifactName}'.`,
    );
  };

  return {
    getRemoteReport,
    uploadReportToRemote,
  };
}

/**
 * Minimal ZIP parser that extracts text content from file entries.
 * GitHub artifact ZIPs typically contain a single JSON file.
 */
function parseZip(buffer: Buffer): string[] {
  const entries: string[] = [];
  let offset = 0;

  while (offset < buffer.length - 4) {
    const signature = buffer.readUInt32LE(offset);

    // Local file header signature
    if (signature !== 0x04034b50) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraFieldLength = buffer.readUInt16LE(offset + 28);

    const dataStart = offset + 30 + fileNameLength + extraFieldLength;

    if (compressionMethod === 0) {
      // Stored (no compression)
      entries.push(buffer.subarray(dataStart, dataStart + uncompressedSize).toString('utf-8'));
    } else if (compressionMethod === 8) {
      // Deflated
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      entries.push(inflateRawSync(compressed).toString('utf-8'));
    }

    offset = dataStart + compressedSize;
  }

  return entries;
}

export default createGitStorage;
