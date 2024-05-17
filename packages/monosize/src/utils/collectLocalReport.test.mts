import { beforeEach, describe, expect, it, vitest } from 'vitest';

import fs from 'node:fs';
import path from 'node:path';
import tmp from 'tmp';
import { findUp } from 'find-up';

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

  // is required as root directory is determined based on Git project
  tmp.dirSync({ dir: projectDir.name, name: '.git', unsafeCleanup: true });

  return { packagesDir: packagesDir.name, rootDir: projectDir.name };
}

function mkReportDir(packagesDir: string, packageName: string, packageRootConfigName: string) {
  const packageRoot = tmp.dirSync({ dir: packagesDir, name: packageName, unsafeCleanup: true }).name;
  const distDir = tmp.dirSync({ dir: packageRoot, name: 'dist', unsafeCleanup: true }).name;
  const monosizeDir = tmp.dirSync({ dir: distDir, name: 'bundle-size', unsafeCleanup: true });

  const packageRootConfigPath = tmp.fileSync({ dir: packageRoot, name: packageRootConfigName }).name;
  fs.writeFileSync(packageRootConfigPath, JSON.stringify({ name: packageName }));

  const reportPath = tmp.fileSync({ dir: monosizeDir.name, name: 'monosize.json' }).name;

  return reportPath;
}

describe('collectLocalReport', () => {
  beforeEach(() => {
    vitest.resetAllMocks();
  });

  it('aggregates all local reports to a single one', async () => {
    const { packagesDir, rootDir } = mkPackagesDir();

    const reportAPath = mkReportDir(packagesDir, 'package-a', 'package.json');
    const reportBPath = mkReportDir(packagesDir, 'package-b', 'project.json');

    const reportA: BuildResult[] = [
      { name: 'fixtureA1', path: 'path/fixtureA1.js', minifiedSize: 100, gzippedSize: 50 },
      { name: 'fixtureA2', path: 'path/fixtureA2.js', minifiedSize: 200, gzippedSize: 100 },
    ];
    const reportB: BuildResult[] = [{ name: 'fixtureB', path: 'path/fixtureB.js', minifiedSize: 10, gzippedSize: 5 }];

    await fs.promises.writeFile(reportAPath, JSON.stringify(reportA));
    await fs.promises.writeFile(reportBPath, JSON.stringify(reportB));

    expect(await collectLocalReport({ root: rootDir, reportFilesGlob: undefined })).toMatchInlineSnapshot(`
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

    const reportAPath = mkReportDir(packagesDir, 'package-a', 'package.json');
    const reportBPath = mkReportDir(packagesDir, 'package-b', 'project.json');

    const reportB: BuildResult[] = [{ name: 'fixtureB', path: 'path/fixtureB.js', minifiedSize: 10, gzippedSize: 5 }];

    await fs.promises.writeFile(reportAPath, '{ name: "fixture", }');
    await fs.promises.writeFile(reportBPath, JSON.stringify(reportB));

    await expect(collectLocalReport({ root: rootDir })).rejects.toThrow(/Failed to read JSON/);
  });

  describe('resolver overrides', () => {
    it('should create local report based on packageName config override', async () => {
      const { packagesDir, rootDir } = mkPackagesDir();

      const reportAPath = mkReportDir(packagesDir, 'package-a', 'package.json');
      const reportBPath = mkReportDir(packagesDir, 'package-b', 'project.json');

      const reportA: BuildResult[] = [
        { name: 'fixtureA1', path: 'path/fixtureA1.js', minifiedSize: 100, gzippedSize: 50 },
      ];
      const reportB: BuildResult[] = [{ name: 'fixtureB', path: 'path/fixtureB.js', minifiedSize: 10, gzippedSize: 5 }];

      await fs.promises.writeFile(reportAPath, JSON.stringify(reportA));
      await fs.promises.writeFile(reportBPath, JSON.stringify(reportB));

      const actual = (
        await collectLocalReport({
          root: rootDir,
          reportResolvers: {
            packageName: async packageRoot => {
              if (fs.existsSync(path.join(packageRoot, 'package.json'))) {
                return (
                  JSON.parse(await fs.promises.readFile(path.join(packageRoot, 'package.json'), 'utf-8')).name +
                  '-overridden-pkg'
                );
              }
              if (fs.existsSync(path.join(packageRoot, 'project.json'))) {
                return (
                  JSON.parse(await fs.promises.readFile(path.join(packageRoot, 'project.json'), 'utf-8')).name +
                  '-overridden-project'
                );
              }

              return 'unknown';
            },
          },
        })
      ).map(({ packageName }) => ({ packageName }));

      expect(actual).toMatchInlineSnapshot(`
      [
        {
          "packageName": "package-a-overridden-pkg",
        },
        {
          "packageName": "package-b-overridden-project",
        },
      ]
    `);
    });

    it('should local report based on packageRoot and packageName config overrides', async () => {
      const { packagesDir, rootDir } = mkPackagesDir();

      const reportAPath = mkReportDir(packagesDir, 'package-a', 'johny5.json');
      const reportBPath = mkReportDir(packagesDir, 'package-b', 'johny5.json');

      const reportA: BuildResult[] = [
        { name: 'fixtureA1', path: 'path/fixtureA1.js', minifiedSize: 100, gzippedSize: 50 },
      ];
      const reportB: BuildResult[] = [{ name: 'fixtureB', path: 'path/fixtureB.js', minifiedSize: 10, gzippedSize: 5 }];

      await fs.promises.writeFile(reportAPath, JSON.stringify(reportA));
      await fs.promises.writeFile(reportBPath, JSON.stringify(reportB));

      const actual = (
        await collectLocalReport({
          root: rootDir,
          reportResolvers: {
            packageRoot: async reportFile => {
              const rootConfig = await findUp('johny5.json', { cwd: path.dirname(reportFile) });

              if (rootConfig) {
                return path.dirname(rootConfig);
              }

              return 'unknown';
            },
            packageName: async packageRoot => {
              return (
                JSON.parse(await fs.promises.readFile(path.join(packageRoot, 'johny5.json'), 'utf-8')).name +
                '-not-disassembled'
              );
            },
          },
        })
      ).map(({ packageName }) => ({ packageName }));

      expect(actual).toMatchInlineSnapshot(`
      [
        {
          "packageName": "package-a-not-disassembled",
        },
        {
          "packageName": "package-b-not-disassembled",
        },
      ]
    `);
    });
  });
});
