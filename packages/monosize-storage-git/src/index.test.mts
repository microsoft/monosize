import AdmZip from 'adm-zip';
import { describe, expect, it, vitest, beforeEach, afterEach } from 'vitest';
import type { BundleSizeReport } from 'monosize';

import createGitStorage from './index.mjs';

function createZip(filename: string, content: string): ArrayBuffer {
  const zip = new AdmZip();
  zip.addFile(filename, Buffer.from(content, 'utf-8'));

  const buf = zip.toBuffer();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const sampleReport: BundleSizeReport = [
  { packageName: 'pkg-a', name: 'Component', path: 'Component.fixture.js', minifiedSize: 500, gzippedSize: 200 },
];

const { mockMkdirSync, mockWriteFileSync } = vitest.hoisted(() => ({
  mockMkdirSync: vitest.fn(),
  mockWriteFileSync: vitest.fn(),
}));

vitest.mock('node:fs', () => ({
  default: {
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
  },
}));

const mockListWorkflowRuns = vitest.fn();
const mockListWorkflowRunArtifacts = vitest.fn();
const mockDownloadArtifact = vitest.fn();

vitest.mock('@octokit/rest', () => ({
  Octokit: class {
    actions = {
      listWorkflowRuns: mockListWorkflowRuns,
      listWorkflowRunArtifacts: mockListWorkflowRunArtifacts,
      downloadArtifact: mockDownloadArtifact,
    };
  },
}));

describe('createGitStorage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vitest.clearAllMocks();
    process.env = { ...originalEnv, GITHUB_TOKEN: 'test-token' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getRemoteReport', () => {
    it('returns report from the first matching artifact', async () => {
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', workflowFileName: 'ci.yml', outputPath: 'dist/report.json', artifactName: 'monosize-report' });
      const storedReport = { commitSHA: 'abc123', data: sampleReport };

      mockListWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [{ id: 100, head_sha: 'abc123' }],
        },
      });

      mockListWorkflowRunArtifacts.mockResolvedValue({
        data: {
          artifacts: [{ id: 200, name: 'monosize-report' }],
        },
      });

      mockDownloadArtifact.mockResolvedValue({
        data: createZip('report.json', JSON.stringify(storedReport)),
      });

      const result = await storage.getRemoteReport('main');

      expect(result.commitSHA).toBe('abc123');
      expect(result.remoteReport).toEqual(sampleReport);

      expect(mockListWorkflowRuns).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'microsoft', repo: 'monosize', branch: 'main', status: 'completed' }),
      );
    });

    it('skips runs without matching artifact and checks the next run', async () => {
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', workflowFileName: 'ci.yml', outputPath: 'dist/report.json', artifactName: 'monosize-report' });
      const storedReport = { commitSHA: 'def456', data: sampleReport };

      mockListWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            { id: 100, head_sha: 'abc123' },
            { id: 101, head_sha: 'def456' },
          ],
        },
      });

      mockListWorkflowRunArtifacts
        .mockResolvedValueOnce({ data: { artifacts: [{ id: 200, name: 'other-artifact' }] } })
        .mockResolvedValueOnce({ data: { artifacts: [{ id: 201, name: 'monosize-report' }] } });

      mockDownloadArtifact.mockResolvedValue({
        data: createZip('report.json', JSON.stringify(storedReport)),
      });

      const result = await storage.getRemoteReport('main');

      expect(result.commitSHA).toBe('def456');
      expect(result.remoteReport).toEqual(sampleReport);
    });

    it('returns empty report when no workflow runs exist', async () => {
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', workflowFileName: 'ci.yml', outputPath: 'dist/report.json', artifactName: 'monosize-report' });

      mockListWorkflowRuns.mockResolvedValue({
        data: { workflow_runs: [] },
      });

      const result = await storage.getRemoteReport('main');

      expect(result.commitSHA).toBe('');
      expect(result.remoteReport).toEqual([]);
    });

    it('returns empty report when no runs have matching artifacts', async () => {
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', workflowFileName: 'ci.yml', outputPath: 'dist/report.json', artifactName: 'monosize-report' });

      mockListWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [{ id: 100, head_sha: 'abc123' }],
        },
      });

      mockListWorkflowRunArtifacts.mockResolvedValue({
        data: { artifacts: [] },
      });

      const result = await storage.getRemoteReport('main');

      expect(result.commitSHA).toBe('');
      expect(result.remoteReport).toEqual([]);
    });

    it('throws when GITHUB_TOKEN is not set', async () => {
      delete process.env['GITHUB_TOKEN'];
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', workflowFileName: 'ci.yml', outputPath: 'dist/report.json', artifactName: 'monosize-report' });

      await expect(storage.getRemoteReport('main')).rejects.toThrow('GITHUB_TOKEN');
    });
  });

  describe('uploadReportToRemote', () => {
    it('writes report to the configured outputPath', async () => {
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', workflowFileName: 'ci.yml', outputPath: 'dist/report.json', artifactName: 'monosize-report' });

      await storage.uploadReportToRemote('main', 'abc123', sampleReport);

      expect(mockMkdirSync).toHaveBeenCalledWith('dist', { recursive: true });
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        'dist/report.json',
        JSON.stringify({ commitSHA: 'abc123', data: sampleReport }, null, 2),
      );
    });
  });

  describe('round-trip with assets field', () => {
    const reportWithAssets: BundleSizeReport = [
      {
        packageName: 'pkg-styles',
        name: 'makeStyles',
        path: 'makeStyles.fixture.js',
        minifiedSize: 1000,
        gzippedSize: 350,
        assets: {
          js: { minifiedSize: 700, gzippedSize: 250 },
          css: { minifiedSize: 300, gzippedSize: 100 },
        },
      },
      // Legacy entry without `assets` — must round-trip cleanly.
      {
        packageName: 'pkg-legacy',
        name: 'old',
        path: 'old.fixture.js',
        minifiedSize: 500,
        gzippedSize: 150,
      },
    ];

    it('preserves assets through write -> read', async () => {
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', workflowFileName: 'ci.yml', outputPath: 'dist/report.json', artifactName: 'monosize-report' });

      await storage.uploadReportToRemote('main', 'sha-1', reportWithAssets);

      const writtenJson = (mockWriteFileSync.mock.calls[0]?.[1] as string) ?? '';
      const stored = JSON.parse(writtenJson);

      mockListWorkflowRuns.mockResolvedValue({ data: { workflow_runs: [{ id: 1, head_sha: 'sha-1' }] } });
      mockListWorkflowRunArtifacts.mockResolvedValue({ data: { artifacts: [{ id: 2, name: 'monosize-report' }] } });
      mockDownloadArtifact.mockResolvedValue({ data: createZip('report.json', JSON.stringify(stored)) });

      const result = await storage.getRemoteReport('main');
      expect(result.commitSHA).toBe('sha-1');
      expect(result.remoteReport).toEqual(reportWithAssets);
      // Both shapes survive: with assets and without.
      expect(result.remoteReport[0].assets).toEqual(reportWithAssets[0].assets);
      expect(result.remoteReport[1].assets).toBeUndefined();
    });
  });
});
