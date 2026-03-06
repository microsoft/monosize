import { describe, expect, it, vitest, beforeEach, afterEach } from 'vitest';
import type { BundleSizeReport } from 'monosize';

import createGitStorage from './index.mjs';

// Minimal ZIP builder for testing: creates a ZIP with a single stored (uncompressed) file
function createZip(filename: string, content: string): ArrayBuffer {
  const contentBuf = Buffer.from(content, 'utf-8');
  const filenameBuf = Buffer.from(filename, 'utf-8');

  // Local file header (30 bytes + filename + content)
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0); // signature
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 8); // compression method: stored
  localHeader.writeUInt32LE(contentBuf.length, 18); // compressed size
  localHeader.writeUInt32LE(contentBuf.length, 22); // uncompressed size
  localHeader.writeUInt16LE(filenameBuf.length, 26); // filename length
  localHeader.writeUInt16LE(0, 28); // extra field length

  // Central directory header (46 bytes + filename)
  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0); // signature
  centralHeader.writeUInt16LE(0, 8); // compression method: stored
  centralHeader.writeUInt32LE(contentBuf.length, 20); // compressed size
  centralHeader.writeUInt32LE(contentBuf.length, 24); // uncompressed size
  centralHeader.writeUInt16LE(filenameBuf.length, 28); // filename length

  // End of central directory (22 bytes)
  const localRecordSize = localHeader.length + filenameBuf.length + contentBuf.length;
  const centralRecordSize = centralHeader.length + filenameBuf.length;

  const endOfCentral = Buffer.alloc(22);
  endOfCentral.writeUInt32LE(0x06054b50, 0); // signature
  endOfCentral.writeUInt16LE(1, 8); // total entries
  endOfCentral.writeUInt16LE(1, 10); // total entries
  endOfCentral.writeUInt32LE(centralRecordSize, 12); // central directory size
  endOfCentral.writeUInt32LE(localRecordSize, 16); // central directory offset

  const zip = Buffer.concat([localHeader, filenameBuf, contentBuf, centralHeader, filenameBuf, endOfCentral]);

  return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
}

const sampleReport: BundleSizeReport = [
  { packageName: 'pkg-a', name: 'Component', path: 'Component.fixture.js', minifiedSize: 500, gzippedSize: 200 },
];

const mockListWorkflowRunsForRepo = vitest.fn();
const mockListWorkflowRunArtifacts = vitest.fn();
const mockDownloadArtifact = vitest.fn();

vitest.mock('@octokit/rest', () => ({
  Octokit: class {
    actions = {
      listWorkflowRunsForRepo: mockListWorkflowRunsForRepo,
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
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', artifactName: 'monosize-report' });
      const storedReport = { commitSHA: 'abc123', data: sampleReport };

      mockListWorkflowRunsForRepo.mockResolvedValue({
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

      expect(mockListWorkflowRunsForRepo).toHaveBeenCalledWith(
        expect.objectContaining({ owner: 'microsoft', repo: 'monosize', branch: 'main', status: 'completed' }),
      );
    });

    it('skips runs without matching artifact and checks the next run', async () => {
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', artifactName: 'monosize-report' });
      const storedReport = { commitSHA: 'def456', data: sampleReport };

      mockListWorkflowRunsForRepo.mockResolvedValue({
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
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', artifactName: 'monosize-report' });

      mockListWorkflowRunsForRepo.mockResolvedValue({
        data: { workflow_runs: [] },
      });

      const result = await storage.getRemoteReport('main');

      expect(result.commitSHA).toBe('');
      expect(result.remoteReport).toEqual([]);
    });

    it('returns empty report when no runs have matching artifacts', async () => {
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', artifactName: 'monosize-report' });

      mockListWorkflowRunsForRepo.mockResolvedValue({
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
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', artifactName: 'monosize-report' });

      await expect(storage.getRemoteReport('main')).rejects.toThrow('GITHUB_TOKEN');
    });
  });

  describe('uploadReportToRemote', () => {
    it('throws a descriptive error', async () => {
      const storage = createGitStorage({ owner: 'microsoft', repo: 'monosize', artifactName: 'monosize-report' });

      await expect(storage.uploadReportToRemote('main', 'abc123', sampleReport)).rejects.toThrow(
        "actions/upload-artifact",
      );
    });
  });
});
