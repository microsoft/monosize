import { beforeEach, describe, expect, it, vitest } from 'vitest';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { up as findUp } from 'empathic/find';

import { collectLocalReport } from './collectLocalReport.mjs';
import type { BuildResult } from '../types.mjs';

function mkPackagesDir() {
  const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collectLocalReport'));
  const packagesDir = path.join(projectDir, 'packages');
  fs.mkdirSync(packagesDir, { recursive: true });

  // is required as root directory is determined based on Git project
  fs.mkdirSync(path.join(projectDir, '.git'), { recursive: true });

  return { packagesDir, rootDir: projectDir };
}

function mkReportDir(packagesDir: string, packageName: string, packageRootConfigName: string) {
  const packageRoot = path.join(packagesDir, packageName);
  const distDir = path.join(packageRoot, 'dist');
  const monosizeDir = path.join(distDir, 'bundle-size');
  fs.mkdirSync(monosizeDir, { recursive: true });

  const packageRootConfigPath = path.join(packageRoot, packageRootConfigName);
  fs.writeFileSync(packageRootConfigPath, JSON.stringify({ name: packageName }));

  return path.join(monosizeDir, 'monosize.json');
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
                  JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8')).name + '-overridden-pkg'
                );
              }
              if (fs.existsSync(path.join(packageRoot, 'project.json'))) {
                return (
                  JSON.parse(fs.readFileSync(path.join(packageRoot, 'project.json'), 'utf-8')).name +
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
              const rootConfig = findUp('johny5.json', { cwd: path.dirname(reportFile) });

              if (rootConfig) {
                return path.dirname(rootConfig);
              }

              return 'unknown';
            },
            packageName: async packageRoot => {
              return (
                JSON.parse(fs.readFileSync(path.join(packageRoot, 'johny5.json'), 'utf-8')).name + '-not-disassembled'
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
