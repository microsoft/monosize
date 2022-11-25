import * as fs from 'fs';
import * as glob from 'glob';
import * as path from 'path';
import { findGitRoot, findPackageRoot } from 'workspace-tools';

import { BuildResult, BundleSizeReport } from '../types';

async function readReportForPackage(
  reportFile: string,
): Promise<{ packageName: string; packageReport: BuildResult[] }> {
  const reportFilePath = path.resolve(process.cwd(), reportFile);
  const packageRoot = findPackageRoot(reportFilePath);

  if (!packageRoot) {
    throw new Error(
      [
        'Failed to find a package root (directory that contains "package.json" file)',
        `Report file location: ${reportFile}`,
      ].join('\n'),
    );
  }

  const packageName = path.basename(packageRoot);
  const packageReportJSON = await fs.promises.readFile(reportFilePath, 'utf8');

  try {
    const packageReport = JSON.parse(packageReportJSON) as BuildResult[];

    return { packageName, packageReport };
  } catch (e) {
    throw new Error([`Failed to read JSON from "${reportFilePath}":`, (e as Error).toString()].join('\n'));
  }
}

type CollectLocalReportOptions = {
  root: string | undefined;
  reportFilesGlob: string;
};

/**
 * Collects all reports for packages to a single one.
 */
export async function collectLocalReport(options: Partial<CollectLocalReportOptions> = {}): Promise<BundleSizeReport> {
  const { reportFilesGlob, root = findGitRoot(process.cwd()) } = {
    root: undefined,
    reportFilesGlob: 'packages/**/dist/bundle-size/bundle-size.json',
    ...options,
  };

  const reportFiles = glob.sync(reportFilesGlob, { cwd: root });
  const reports = await Promise.all(reportFiles.map(readReportForPackage));

  return reports.reduce<BundleSizeReport>((acc, { packageName, packageReport }) => {
    const processedReport = packageReport.map(reportEntry => ({ packageName, ...reportEntry }));

    return [...acc, ...processedReport];
  }, []);
}
