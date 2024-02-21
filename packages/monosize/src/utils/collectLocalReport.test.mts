import { beforeEach, describe, expect, it, vitest } from 'vitest';

import fs from 'node:fs';
import tmp from 'tmp';

// This mock should be not required 😮
// glob.sync() call in collectLocalReport.ts always returns an empty array on Linux/Windows in tests for an unknown
// reason while files are present in filesystem
vitest.mock('glob', async () => {
  const actual = await vitest.importActual<Record<string, unknown>>('glob');
  return {
    ...actual,
    sync: () => [
      'packages/package-a/dist/bundle-size/monosize.json',
      'packages/package-b/dist/bundle-size/monosize.json',
    ],
  };
});

import { collectLocalReport } from './collectLocalReport.mjs';
import type { BuildResult } from '../types.mjs';

function mkPackagesDir() {
  const projectDir = tmp.dirSync({ prefix: 'collectLocalReport', unsafeCleanup: true });
  const packagesDir = tmp.dirSync({ dir: projectDir.name, name: 'packages', unsafeCleanup: true });

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(projectDir.name);

  // is required as root directory is determined based on Git project
  tmp.dirSync({ dir: projectDir.name, name: '.git', unsafeCleanup: true });

  return { packagesDir: packagesDir.name, rootDir: projectDir.name };
}

function mkReportDir(packagesDir: string): string {
  const distDir = tmp.dirSync({ dir: packagesDir, name: 'dist', unsafeCleanup: true });
  const monosizeDir = tmp.dirSync({ dir: distDir.name, name: 'bundle-size', unsafeCleanup: true });

  tmp.fileSync({ dir: packagesDir, name: 'package.json' });

  return tmp.fileSync({ dir: monosizeDir.name, name: 'monosize.json' }).name;
}

describe('collectLocalReport', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('aggregates all local reports to a single one', async () => {
    const { packagesDir, rootDir } = mkPackagesDir();

    const reportAPath = mkReportDir(tmp.dirSync({ dir: packagesDir, name: 'package-a', unsafeCleanup: true }).name);
    const reportBPath = mkReportDir(tmp.dirSync({ dir: packagesDir, name: 'package-b', unsafeCleanup: true }).name);

    const reportA: BuildResult[] = [
      { name: 'fixtureA1', path: 'path/fixtureA1.js', minifiedSize: 100, gzippedSize: 50 },
      { name: 'fixtureA2', path: 'path/fixtureA2.js', minifiedSize: 200, gzippedSize: 100 },
    ];
    const reportB: BuildResult[] = [{ name: 'fixtureB', path: 'path/fixtureB.js', minifiedSize: 10, gzippedSize: 5 }];

    await fs.promises.writeFile(reportAPath, JSON.stringify(reportA));
    await fs.promises.writeFile(reportBPath, JSON.stringify(reportB));

    expect(await collectLocalReport({ root: rootDir })).toMatchInlineSnapshot(`
      [
        {
          "gzippedSize": 50,
          "minifiedSize": 100,
          "name": "fixtureA1",
          "packageName": "package-a",
          "path": "path/fixtureA1.js",
        },
        {
          "gzippedSize": 100,
          "minifiedSize": 200,
          "name": "fixtureA2",
          "packageName": "package-a",
          "path": "path/fixtureA2.js",
        },
        {
          "gzippedSize": 5,
          "minifiedSize": 10,
          "name": "fixtureB",
          "packageName": "package-b",
          "path": "path/fixtureB.js",
        },
      ]
    `);
  });

  it('throws an error if a report file contains invalid JSON', async () => {
    const { packagesDir, rootDir } = mkPackagesDir();

    const reportAPath = mkReportDir(tmp.dirSync({ dir: packagesDir, name: 'package-a', unsafeCleanup: true }).name);
    const reportBPath = mkReportDir(tmp.dirSync({ dir: packagesDir, name: 'package-b', unsafeCleanup: true }).name);

    const reportB: BuildResult[] = [{ name: 'fixtureB', path: 'path/fixtureB.js', minifiedSize: 10, gzippedSize: 5 }];

    await fs.promises.writeFile(reportAPath, '{ name: "fixture", }');
    await fs.promises.writeFile(reportBPath, JSON.stringify(reportB));

    await expect(collectLocalReport({ root: rootDir })).rejects.toThrow(/Failed to read JSON/);
  });
});
