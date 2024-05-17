import glob from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { findGitRoot } from 'workspace-tools';
import { findUp } from 'find-up';

import type { BuildResult, BundleSizeReport, MonoSizeConfig } from '../types.mjs';

async function getPackageRoot(reportFilePath: string): Promise<string> {
  const rootConfig = await findUp(['package.json', 'project.json'], { cwd: path.dirname(reportFilePath) });

  if (!rootConfig) {
    throw new Error(
      [
        'Failed to find a package root (directory that contains "package.json" or "project.json" file)',
        `Report file location: ${reportFilePath}`,
        `Tip: You can override package root resolution by providing "packageRoot" function in the configuration`,
      ].join('\n'),
    );
  }

  return path.dirname(rootConfig);
}

async function getPackageName(packageRoot: string): Promise<string> {
  const paths = {
    packageJson: path.join(packageRoot, 'package.json'),
    projectJson: path.join(packageRoot, 'project.json'),
  };
  let getPackageNameFromConfigFile;

  if (fs.existsSync(paths.packageJson)) {
    getPackageNameFromConfigFile = async () => JSON.parse(await fs.promises.readFile(paths.packageJson, 'utf8')).name;
  }
  if (fs.existsSync(paths.projectJson)) {
    getPackageNameFromConfigFile = async () => JSON.parse(await fs.promises.readFile(paths.projectJson, 'utf8')).name;
  }

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
    const packageName = await getPackageNameFromConfigFile();
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
    const packageReport: BuildResult[] = JSON.parse(await fs.promises.readFile(reportFile, 'utf8'));

    return { packageName, packageReport };
  } catch (e) {
    throw new Error([`Failed to read JSON from "${reportFile}":`, (e as Error).toString()].join('\n'));
  }
}

type CollectLocalReportOptions = {
  root: string | undefined;
  reportFilesGlob: string;
};

type Resolvers = Pick<MonoSizeConfig, 'reportResolvers'>;
const defaultResolvers = { packageName: getPackageName, packageRoot: getPackageRoot };

interface Options extends Partial<CollectLocalReportOptions>, Resolvers {}

/**
 * Collects all reports for packages to a single one.
 */
export async function collectLocalReport(options: Options): Promise<BundleSizeReport> {
  const {
    reportResolvers,
    reportFilesGlob = 'packages/**/dist/bundle-size/monosize.json',
    root = findGitRoot(process.cwd()),
  } = options;

  const resolvers = { ...defaultResolvers, ...reportResolvers };

  const reportFiles = glob.sync(reportFilesGlob, { absolute: true, cwd: root });
  const reports = await Promise.all(reportFiles.map(reportFile => readReportForPackage(reportFile, resolvers)));

  return reports.reduce<BundleSizeReport>((acc, { packageName, packageReport }) => {
    const processedReport = packageReport.map(reportEntry => ({ packageName, ...reportEntry }));

    return [...acc, ...processedReport];
  }, []);
}
