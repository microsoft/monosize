import glob from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { findGitRoot } from 'workspace-tools';
import { findUp } from 'find-up';

import type { BuildResult, BundleSizeReport, MonoSizeConfig } from '../types.mjs';

async function getPackageRoot(filepath: string): Promise<string> {
  const root = await findUp(['package.json', 'project.json'], { cwd: path.dirname(filepath) });

  if (!root) {
    throw new Error(
      [
        'Failed to find a package root (directory that contains "package.json" or "project.json" file)',
        `Report file location: ${filepath}`,
        `Tip: You can override package root resolution by providing "packageRoot" function in the configuration`,
      ].join('\n'),
    );
  }

  return root;
}

const packageNameConfigFiles: Record<string, (rootConfigPath: string) => Promise<string>> = {
  'package.json': async (rootConfigPath: string) => JSON.parse(await fs.promises.readFile(rootConfigPath, 'utf8')).name,
  'project.json': async (rootConfigPath: string) => JSON.parse(await fs.promises.readFile(rootConfigPath, 'utf8')).name,
};
async function getPackageName(packageRoot: string): Promise<string> {
  const getPackageNameFromConfigFile = packageNameConfigFiles[path.basename(packageRoot)];

  if (!getPackageNameFromConfigFile) {
    throw new Error(
      [
        'Package root does not contain "package.json" or "project.json" file',
        `Package root location: ${packageRoot}`,
        `Tip: If you use 'packageRoot' config override make sure that it returns one of 'package.json' | 'project.json' file paths or provide also 'packageName' config override that accommodates your packageRoot resolution logic.`,
      ].join('\n'),
    );
  }

  try {
    const packageName = await getPackageNameFromConfigFile(packageRoot);
    return packageName;
  } catch (err) {
    throw new Error(
      [`Failed to read/parse package name from "${packageRoot}" file`, 'Original Error:', err].join('\n'),
    );
  }
}

/**
 *
 * @param reportFile - absolute path to the report file
 */
async function readReportForPackage(
  reportFile: string,
  resolvers: typeof defaultResolvers,
): Promise<{ packageName: string; packageReport: BuildResult[] }> {
  const packageRoot = await resolvers.packageRoot(reportFile);
  const packageName = await resolvers.packageName(packageRoot);

  try {
    const packageReportJSON = await fs.promises.readFile(reportFile, 'utf8');
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

type Resolvers = Pick<MonoSizeConfig, 'packageName' | 'packageRoot'>;
const defaultResolvers = { packageName: getPackageName, packageRoot: getPackageRoot };

interface Options extends Partial<CollectLocalReportOptions>, Resolvers {}

/**
 * Collects all reports for packages to a single one.
 */
export async function collectLocalReport(options: Options): Promise<BundleSizeReport> {
  const {
    packageName,
    packageRoot,
    reportFilesGlob,
    root = findGitRoot(process.cwd()),
  } = {
    root: undefined,
    reportFilesGlob: 'packages/**/dist/bundle-size/monosize.json',
    ...options,
  };

  const resolvers = {
    ...defaultResolvers,
    packageName,
    packageRoot,
  } as Required<Resolvers>;

  const reportFiles = glob.sync(reportFilesGlob, { absolute: true, cwd: root });
  const reports = await Promise.all(reportFiles.map(reportFile => readReportForPackage(reportFile, resolvers)));

  return reports.reduce<BundleSizeReport>((acc, { packageName, packageReport }) => {
    const processedReport = packageReport.map(reportEntry => ({ packageName, ...reportEntry }));

    return [...acc, ...processedReport];
  }, []);
}
