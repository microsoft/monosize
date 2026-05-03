import { afterEach, beforeEach, describe, expect, it, vitest } from 'vitest';
import type { BundleSizeReport } from 'monosize';

import createUpstashStorage from './index.mjs';

// In-memory store backing the @upstash/redis mock; reset per test.
const store = new Map<string, unknown>();

// Mocks the @upstash/redis client. The real client auto-deserializes JSON
// on `get`, so we mirror that here: `set` parses a JSON-string value back
// into an object before storing, and `get` returns it as-is.
vitest.mock('@upstash/redis', () => ({
  Redis: class {
    async get(key: string) {
      return store.get(key) ?? null;
    }
    async set(key: string, value: unknown) {
      const parsed = typeof value === 'string' ? safeJsonParse(value) : value;
      store.set(key, parsed);
      return 'OK';
    }
  },
}));

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

describe('createUpstashStorage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    store.clear();
    process.env = { ...originalEnv, UPSTASH_WRITE_TOKEN: 'write-token' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('round-trip', () => {
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
    ];

    it('preserves assets through upload -> getRemote', async () => {
      const storage = createUpstashStorage({ url: 'https://example', readonlyToken: 'read-token' });

      await storage.uploadReportToRemote('main', 'sha-1', reportWithAssets);
      const result = await storage.getRemoteReport('main');

      expect(result.commitSHA).toBe('sha-1');
      expect(result.remoteReport).toEqual(reportWithAssets);
      expect(result.remoteReport[0].assets).toEqual(reportWithAssets[0].assets);
    });

    it('handles legacy entries without `assets`', async () => {
      const legacyReport: BundleSizeReport = [
        {
          packageName: 'pkg-legacy',
          name: 'old',
          path: 'old.fixture.js',
          minifiedSize: 500,
          gzippedSize: 150,
        },
      ];
      const storage = createUpstashStorage({ url: 'https://example', readonlyToken: 'read-token' });

      await storage.uploadReportToRemote('main', 'sha-2', legacyReport);
      const result = await storage.getRemoteReport('main');

      expect(result.remoteReport).toEqual(legacyReport);
      expect(result.remoteReport[0].assets).toBeUndefined();
    });
  });

  describe('uploadReportToRemote', () => {
    it('throws when UPSTASH_WRITE_TOKEN is not set', async () => {
      delete process.env['UPSTASH_WRITE_TOKEN'];
      const storage = createUpstashStorage({ url: 'https://example', readonlyToken: 'read-token' });

      await expect(storage.uploadReportToRemote('main', 'sha-x', [])).rejects.toThrow('UPSTASH_WRITE_TOKEN');
    });
  });

  describe('getRemoteReport', () => {
    it('throws when no value is stored for the branch', async () => {
      const storage = createUpstashStorage({ url: 'https://example', readonlyToken: 'read-token' });

      await expect(storage.getRemoteReport('missing-branch')).rejects.toThrow('Failed to get data from a remote host');
    });
  });
});
