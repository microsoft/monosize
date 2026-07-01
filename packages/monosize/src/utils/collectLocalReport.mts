import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { any as findUp } from 'empathic/find';
import { glob } from 'tinyglobby';

import type { BundleSizeReport, MonoSizeConfig, StoredReportEntry, ThresholdValue } from '../types.mjs';
import { parseThreshold } from './helpers.mjs';

type CollectLocalReportOptions = {
  root: string | undefined;
  reportFilesGlob: string;
};
type ReportResolvers = Required<NonNullable<MonoSizeConfig['reportResolvers']>>;

interface Options extends Partial<CollectLocalReportOptions>, Pick<MonoSizeConfig, 'reportResolvers'> {}

async function getPackageRoot(reportFilePath: string): Promise<string> {
  const rootConfig = findUp(['package.json', 'project.json'], { cwd: path.dirname(reportFilePath) });

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
      { cause: err },
    );
  }
}

async function readReportForPackage(
  reportFile: string,
  resolvers: ReportResolvers,
): Promise<{ packageName: string; packageReport: StoredReportEntry[] }> {
  const packageRoot = await resolvers.packageRoot(reportFile);
  const packageName = await resolvers.packageName(packageRoot);

  try {
    const packageReport: StoredReportEntry[] = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

    return { packageName, packageReport };
  } catch (e) {
    throw new Error([`Failed to read JSON from "${reportFile}":`, (e as Error).toString()].join('\n'), {
      cause: e,
    });
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

const MONOSIZE_CONFIG_FILES = ['monosize.config.mjs', 'monosize.config.js'] as const;

/**
 * Reads the `threshold` from a `monosize.config.mjs` (or `.js`) located
 * **directly** in `packageRoot` — does NOT walk up the directory tree.
 * Returns `undefined` when no config file exists there or when the config
 * does not define `threshold`.
 */
async function readThresholdFromPackageRoot(packageRoot: string): Promise<string | undefined> {
  for (const configFile of MONOSIZE_CONFIG_FILES) {
    const configPath = path.join(packageRoot, configFile);

    if (!fs.existsSync(configPath)) {
      continue;
    }

    try {
      const configModule = await import(pathToFileURL(configPath).toString());
      const config = configModule.default as MonoSizeConfig | undefined;

      if (typeof config?.threshold === 'string') {
        return config.threshold;
      }
    } catch (err) {
      console.warn(`[monosize] Failed to load config from "${configPath}": ${String(err)}`);
    }

    // Found the config file (even if it had no `threshold`), stop searching.
    return undefined;
  }

  return undefined;
}

/**
 * Builds a per-package threshold resolver by reading each package's own
 * `monosize.config.mjs` (looked up directly in the package root, not walked
 * up the tree).
 *
 * Precedence (highest → lowest):
 *   1. `threshold` from the package's own `monosize.config.mjs`
 *   2. `fallbackThreshold` (typically from the root `monosize.config.mjs`)
 *
 * The returned function is safe to call with any package name — packages
 * without a per-package config entry fall back to `fallbackThreshold`.
 */
export async function buildPackageThresholdResolver(
  options: Options,
  fallbackThreshold: ThresholdValue,
): Promise<(packageName: string) => ThresholdValue> {
  const {
    reportResolvers,
    reportFilesGlob = 'packages/**/dist/bundle-size/monosize.json',
    root = findGitRoot(process.cwd()),
  } = options;

  const resolvers = { ...DEFAULT_RESOLVERS, ...reportResolvers };
  const reportFiles = await glob(reportFilesGlob, { absolute: true, cwd: root });

  const thresholds = new Map<string, ThresholdValue>();

  await Promise.all(
    reportFiles.map(async reportFile => {
      try {
        const packageRoot = await resolvers.packageRoot(reportFile);
        const packageName = await resolvers.packageName(packageRoot);
        const thresholdStr = await readThresholdFromPackageRoot(packageRoot);

        if (thresholdStr !== undefined) {
          thresholds.set(packageName, parseThreshold(thresholdStr));
        }
      } catch {
        // If package root / name can't be resolved, skip — collectLocalReport
        // will surface the error when it processes the same file.
      }
    }),
  );

  return (packageName: string) => thresholds.get(packageName) ?? fallbackThreshold;
}
