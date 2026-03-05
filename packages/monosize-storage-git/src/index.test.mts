import { describe, expect, it, vitest, beforeEach } from 'vitest';
import type { BundleSizeReport } from 'monosize';

import createGitStorage from './index.mjs';

vitest.mock('node:child_process', () => ({
  execSync: vitest.fn(),
}));

vitest.mock('node:fs', () => ({
  default: {
    mkdirSync: vitest.fn(),
    writeFileSync: vitest.fn(),
  },
}));

const { execSync } = await import('node:child_process') as { execSync: ReturnType<typeof vitest.fn> };
const fs = (await import('node:fs')).default as {
  mkdirSync: ReturnType<typeof vitest.fn>;
  writeFileSync: ReturnType<typeof vitest.fn>;
};

const sampleReport: BundleSizeReport = [
  { packageName: 'pkg-a', name: 'Component', path: 'Component.fixture.js', minifiedSize: 500, gzippedSize: 200 },
];

describe('createGitStorage', () => {
  beforeEach(() => {
    vitest.clearAllMocks();
  });

  describe('getRemoteReport', () => {
    it('returns remote report from git', async () => {
      const storage = createGitStorage({ reportPath: 'bundle-size-report.json' });

      execSync.mockImplementation((cmd: string) => {
        if (cmd === 'git rev-parse main') {
          return 'abc123\n';
        }
        if (cmd === 'git show main:bundle-size-report.json') {
          return JSON.stringify({ commitSHA: 'abc123', data: sampleReport });
        }
        throw new Error(`Unexpected command: ${cmd}`);
      });

      const result = await storage.getRemoteReport('main');

      expect(result.commitSHA).toBe('abc123');
      expect(result.remoteReport).toEqual(sampleReport);
    });

    it('returns empty report when branch does not exist', async () => {
      const storage = createGitStorage({ reportPath: 'bundle-size-report.json' });

      execSync.mockImplementation(() => {
        throw new Error('fatal: not a valid object name');
      });

      const result = await storage.getRemoteReport('non-existent');

      expect(result.commitSHA).toBe('');
      expect(result.remoteReport).toEqual([]);
    });

    it('returns empty report when file does not exist on branch', async () => {
      const storage = createGitStorage({ reportPath: 'bundle-size-report.json' });

      execSync.mockImplementation((cmd: string) => {
        if (cmd === 'git rev-parse main') {
          return 'abc123\n';
        }
        throw new Error('fatal: path does not exist');
      });

      const result = await storage.getRemoteReport('main');

      expect(result.commitSHA).toBe('abc123');
      expect(result.remoteReport).toEqual([]);
    });
  });

  describe('uploadReportToRemote', () => {
    it('writes report to the configured path', async () => {
      const storage = createGitStorage({ reportPath: 'bundle-size-report.json' });

      await storage.uploadReportToRemote('main', 'abc123', sampleReport);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'bundle-size-report.json',
        JSON.stringify({ commitSHA: 'abc123', data: sampleReport }, null, 2),
      );
    });

    it('creates directories when reportPath contains subdirectories', async () => {
      const storage = createGitStorage({ reportPath: 'reports/bundle-size-report.json' });

      await storage.uploadReportToRemote('main', 'abc123', sampleReport);

      expect(fs.mkdirSync).toHaveBeenCalledWith('reports', { recursive: true });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'reports/bundle-size-report.json',
        JSON.stringify({ commitSHA: 'abc123', data: sampleReport }, null, 2),
      );
    });

    it('does not create directories when reportPath is in the root', async () => {
      const storage = createGitStorage({ reportPath: 'report.json' });

      await storage.uploadReportToRemote('main', 'abc123', sampleReport);

      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });
});
