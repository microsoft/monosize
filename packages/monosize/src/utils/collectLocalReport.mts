import glob from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { findGitRoot } from 'workspace-tools';

import type { BuildResult, BundleSizeReport, MonoSizeConfig } from '../types.mjs';
import { findUp } from 'find-up';

async function getPackageName(root: string): Promise<string> {
  const packageNameSourcesPaths = {
    packageJson: path.join(root, 'package.json'),
    projectJson: path.join(root, 'project.json'),
  };

  const hasPackageJson = fs.existsSync(packageNameSourcesPaths.packageJson);
  const hasProjectJson = fs.existsSync(packageNameSourcesPaths.projectJson);

  if (!(hasPackageJson || hasProjectJson)) {
    throw new Error(
      [
        'Failed to find a package root (directory that contains "package.json" or "project.json" file)',
        `Package root location: ${root}`,
      ].join('\n'),
    );
  }

  try {
    if (hasPackageJson) {
      return JSON.parse(fs.readFileSync(packageNameSourcesPaths.packageJson, 'utf8')).name as string;
    }

    if (hasProjectJson) {
      return JSON.parse(fs.readFileSync(packageNameSourcesPaths.projectJson, 'utf8')).name as string;
    }

    throw new Error('Failed to read package name from "package.json" or "project.json"');
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

/**
 *
 * @param reportFile - absolute path to the report file
 */
async function readReportForPackage(
  reportFile: string,
  resolvePackageName = getPackageName,
): Promise<{ packageName: string; packageReport: BuildResult[] }> {
  const packageRoot = await findUp(['package.json', 'project.json'], { cwd: path.dirname(reportFile) });
  // const packageRoot = searchUp(reportFile, process.cwd());

  if (!packageRoot) {
    throw new Error(
      [
        'Failed to find a package root (directory that contains "package.json" file)',
        `Report file location: ${reportFile}`,
      ].join('\n'),
    );
  }

  const packageName = await resolvePackageName(packageRoot);
  const packageReportJSON = await fs.promises.readFile(reportFile, 'utf8');

  try {
    const packageReport = JSON.parse(packageReportJSON) as BuildResult[];

    return { packageName, packageReport };
  } catch (e) {
    throw new Error([`Failed to read JSON from "${reportFile}":`, (e as Error).toString()].join('\n'));
  }
}

type CollectLocalReportOptions = {
  root: string | undefined;
  reportFilesGlob: string;
};

interface Options extends Partial<CollectLocalReportOptions>, Pick<MonoSizeConfig, 'packageName' | 'packagePath'> {}

/**
 * Collects all reports for packages to a single one.
 */
export async function collectLocalReport(options: Options): Promise<BundleSizeReport> {
  const {
    packageName,
    reportFilesGlob,
    root = findGitRoot(process.cwd()),
  } = {
    root: undefined,
    reportFilesGlob: 'packages/**/dist/bundle-size/monosize.json',
    ...options,
  };

  const reportFiles = glob.sync(reportFilesGlob, { absolute: true, cwd: root });
  const reports = await Promise.all(reportFiles.map(reportFile => readReportForPackage(reportFile, packageName)));

  return reports.reduce<BundleSizeReport>((acc, { packageName, packageReport }) => {
    const processedReport = packageReport.map(reportEntry => ({ packageName, ...reportEntry }));

    return [...acc, ...processedReport];
  }, []);
}
