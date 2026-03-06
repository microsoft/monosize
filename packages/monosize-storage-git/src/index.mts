import AdmZip from 'adm-zip';
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

      const zip = new AdmZip(Buffer.from(zipData as ArrayBuffer));
      const entry = zip.getEntries()[0];

      if (!entry) {
        continue;
      }

      const report: StoredReport = JSON.parse(entry.getData().toString('utf-8'));

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

export default createGitStorage;
