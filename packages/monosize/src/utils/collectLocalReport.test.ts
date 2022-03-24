import * as fs from 'fs';
import * as tmp from 'tmp';

// This mock should be not required 😮
// glob.sync() call in collectLocalReport.ts always returns an empty array on Linux/Windows in tests for an unknown
// reason while files are present in filesystem
jest.mock('glob', () => ({
  sync: () => [
    'packages/package-a/dist/monosize/monosize.json',
    'packages/package-b/dist/monosize/monosize.json',
  ],
}));

import { BuildResult } from '../types';
import { collectLocalReport } from './collectLocalReport';

/**
 * @return {string}
 */
function mkPackagesDir() {
  const projectDir = tmp.dirSync({ prefix: 'collectLocalReport', unsafeCleanup: true });
  const packagesDir = tmp.dirSync({ dir: projectDir.name, name: 'packages', unsafeCleanup: true });

  const spy = jest.spyOn(process, 'cwd');
  spy.mockReturnValue(projectDir.name);

  // is required as root directory is determined based on Git project
  tmp.dirSync({ dir: projectDir.name, name: '.git', unsafeCleanup: true });

  return packagesDir.name;
}

function mkReportDir(packagesDir: string): string {
  const distDir = tmp.dirSync({ dir: packagesDir, name: 'dist', unsafeCleanup: true });
  const monosizeDir = tmp.dirSync({ dir: distDir.name, name: 'monosize', unsafeCleanup: true });

  tmp.fileSync({ dir: packagesDir, name: 'package.json' });

  return tmp.fileSync({ dir: monosizeDir.name, name: 'monosize.json' }).name;
}

describe('collectLocalReport', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('aggregates all local reports to a single one', async () => {
    const packagesDir = mkPackagesDir();

    const reportAPath = mkReportDir(tmp.dirSync({ dir: packagesDir, name: 'package-a', unsafeCleanup: true }).name);
    const reportBPath = mkReportDir(tmp.dirSync({ dir: packagesDir, name: 'package-b', unsafeCleanup: true }).name);

    const reportA: BuildResult[] = [
      { name: 'fixtureA1', path: 'path/fixtureA1.js', minifiedSize: 100, gzippedSize: 50 },
      { name: 'fixtureA2', path: 'path/fixtureA2.js', minifiedSize: 200, gzippedSize: 100 },
    ];
    const reportB: BuildResult[] = [{ name: 'fixtureB', path: 'path/fixtureB.js', minifiedSize: 10, gzippedSize: 5 }];

    await fs.promises.writeFile(reportAPath, JSON.stringify(reportA));
    await fs.promises.writeFile(reportBPath, JSON.stringify(reportB));

    expect(await collectLocalReport()).toMatchInlineSnapshot(`
      Array [
        Object {
          "gzippedSize": 50,
          "minifiedSize": 100,
          "name": "fixtureA1",
          "packageName": "package-a",
          "path": "path/fixtureA1.js",
        },
        Object {
          "gzippedSize": 100,
          "minifiedSize": 200,
          "name": "fixtureA2",
          "packageName": "package-a",
          "path": "path/fixtureA2.js",
        },
        Object {
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
    const packagesDir = mkPackagesDir();

    const reportAPath = mkReportDir(tmp.dirSync({ dir: packagesDir, name: 'package-a', unsafeCleanup: true }).name);
    const reportBPath = mkReportDir(tmp.dirSync({ dir: packagesDir, name: 'package-b', unsafeCleanup: true }).name);

    const reportB: BuildResult[] = [{ name: 'fixtureB', path: 'path/fixtureB.js', minifiedSize: 10, gzippedSize: 5 }];

    await fs.promises.writeFile(reportAPath, '{ name: "fixture", }');
    await fs.promises.writeFile(reportBPath, JSON.stringify(reportB));

    await expect(collectLocalReport()).rejects.toThrow(/Failed to read JSON/);
  });
});
