import { glob } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { findUp } from 'find-up';

import type { BuildResult, BundleSizeReport, MonoSizeConfig } from '../types.mjs';

type CollectLocalReportOptions = {
  root: string | undefined;
  reportFilesGlob: string;
};
type ReportResolvers = Required<NonNullable<MonoSizeConfig['reportResolvers']>>;

interface Options extends Partial<CollectLocalReportOptions>, Pick<MonoSizeConfig, 'reportResolvers'> {}

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
    getPackageNameFromConfigFile = async () => JSON.parse(fs.readFileSync(paths.packageJson, 'utf8')).name;
  }
  if (fs.existsSync(paths.projectJson)) {
    getPackageNameFromConfigFile = async () => JSON.parse(fs.readFileSync(paths.projectJson, 'utf8')).name;
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

async function readReportForPackage(
  reportFile: string,
  resolvers: ReportResolvers,
): Promise<{ packageName: string; packageReport: BuildResult[] }> {
  const packageRoot = await resolvers.packageRoot(reportFile);
  const packageName = await resolvers.packageName(packageRoot);

  try {
    const packageReport: BuildResult[] = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

    return { packageName, packageReport };
  } catch (e) {
    throw new Error([`Failed to read JSON from "${reportFile}":`, (e as Error).toString()].join('\n'));
  }
}

function findGitRoot(cwd: string) {
  const output = execSync('git rev-parse --show-toplevel', { cwd });

  return output.toString().trim();
}

const DEFAULT_RESOLVERS: ReportResolvers = {
  packageName: getPackageName,
  packageRoot: getPackageRoot,
};

/**
 * Collects all reports for packages to a single one.
 */
export async function collectLocalReport(options: Options): Promise<BundleSizeReport> {
  const {
    reportResolvers,
    reportFilesGlob = 'packages/**/dist/bundle-size/monosize.json',
    root = findGitRoot(process.cwd()),
  } = options;

  const resolvers = { ...DEFAULT_RESOLVERS, ...reportResolvers };

  const reportFiles = await glob(reportFilesGlob, { absolute: true, cwd: root });
  const reports = await Promise.all(reportFiles.map(reportFile => readReportForPackage(reportFile, resolvers)));

  return reports
    .reduce<BundleSizeReport>((acc, { packageName, packageReport }) => {
      const processedReport = packageReport.map(reportEntry => ({ packageName, ...reportEntry }));

      return [...acc, ...processedReport];
    }, [])
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
