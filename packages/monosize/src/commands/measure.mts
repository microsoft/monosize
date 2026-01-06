import Table from 'cli-table3';
import { glob } from 'glob';
import { gzipSizeFromFile } from 'gzip-size';
import fs from 'node:fs';
import path from 'node:path';
import type { CommandModule } from 'yargs';

import { formatBytes } from '../utils/helpers.mjs';
import { prepareFixture } from '../utils/prepareFixture.mjs';
import { readConfig } from '../utils/readConfig.mjs';
import type { CliOptions } from '../index.mjs';
import type { BuildResult } from '../types.mjs';
import { logger, timestamp } from '../logger.mjs';

export type MeasureOptions = CliOptions & {
  debug: boolean;
  'artifacts-location': string;
  fixtures: string;
  'single-build': boolean;
};

/**
 * Measures the size of a single built fixture output.
 */
async function measureFixtureSize(
  outputPath: string,
  name: string,
  originalPath: string,
): Promise<BuildResult> {
  const minifiedSize = (await fs.promises.stat(outputPath)).size;
  const gzippedSize = await gzipSizeFromFile(outputPath);

  return {
    name,
    path: path.relative(process.cwd(), originalPath).replaceAll(path.sep, '/'),
    minifiedSize,
    gzippedSize,
  };
}

/**
 * Builds fixtures using single-build mode (all at once with multi-entry).
 */
async function buildFixturesInSingleMode(
  config: Awaited<ReturnType<typeof readConfig>>,
  fixtures: string[],
  artifactsDir: string,
  debug: boolean,
  quiet: boolean,
): Promise<BuildResult[]> {
  const buildStartTime = process.hrtime();

  // Prepare all fixtures first
  const preparedFixtures = await Promise.all(
    fixtures.map(async fixturePath => {
      const { artifactPath, name } = await prepareFixture(artifactsDir, fixturePath);
      return { fixturePath: artifactPath, name, originalPath: fixturePath };
    }),
  );

  // Build all fixtures at once
  const buildResults = await config.bundler.buildFixtures({
    fixtures: preparedFixtures.map(f => ({ fixturePath: f.fixturePath, name: f.name })),
    debug,
    quiet,
  });

  // Measure sizes for each output
  const measurements = await Promise.all(
    buildResults.map((result, i) =>
      measureFixtureSize(result.outputPath, result.name, preparedFixtures[i].originalPath),
    ),
  );

  if (!quiet) {
    logger.info(`All ${fixtures.length} fixture(s) built in single build`, buildStartTime);
  }

  return measurements;
}

/**
 * Builds fixtures using loop mode (one at a time).
 */
async function buildFixturesInLoopMode(
  config: Awaited<ReturnType<typeof readConfig>>,
  fixtures: string[],
  artifactsDir: string,
  debug: boolean,
  quiet: boolean,
): Promise<BuildResult[]> {
  const measurements: BuildResult[] = [];

  for (const fixturePath of fixtures) {
    const fixtureStartTime = process.hrtime();

    const { artifactPath, name } = await prepareFixture(artifactsDir, fixturePath);
    const { outputPath } = await config.bundler.buildFixture({
      debug,
      fixturePath: artifactPath,
      quiet,
    });

    const measurement = await measureFixtureSize(outputPath, name, fixturePath);
    measurements.push(measurement);

    if (!quiet) {
      logger.info(`Fixture "${path.basename(fixturePath)}" built`, fixtureStartTime);
    }
  }

  return measurements;
}

/**
 * Displays the measurement results in a table format.
 */
function displayResults(measurements: BuildResult[], startTime: [number, number], quiet: boolean): void {
  if (quiet) {
    return;
  }

  const table = new Table({
    head: ['Fixture', 'Minified size', 'GZIP size'],
  });
  const sortedMeasurements = [...measurements].sort((a, b) => a.path.localeCompare(b.path));

  sortedMeasurements.forEach(r => {
    table.push([r.name, formatBytes(r.minifiedSize), formatBytes(r.gzippedSize)]);
  });

  logger.raw(table.toString());
  logger.finish(`Completed`, startTime);
}

async function measure(options: MeasureOptions) {
  const {
    debug = false,
    quiet,
    'artifacts-location': artifactsLocation,
    fixtures: fixturesGlob,
    'single-build': singleBuild = false,
  } = options;

  const startTime = timestamp();
  const artifactsDir = path.resolve(process.cwd(), artifactsLocation);

  // thrown error if cwd is set as artifactsLocation is set to '.' since next step is to rm everything
  if (artifactsDir === process.cwd()) {
    throw new Error("'--artifacts-location' cannot be the same as current working directory");
  }

  await fs.promises.rm(artifactsDir, { recursive: true, force: true });
  await fs.promises.mkdir(artifactsDir, { recursive: true });

  if (!quiet) {
    if (debug) {
      logger.info('Running in debug mode...');
    }
    logger.info('Artifacts dir is cleared');
  }

  const fixtures = await glob(`bundle-size/${fixturesGlob}`, {
    absolute: true,
    cwd: process.cwd(),
  });

  if (!fixtures.length && fixturesGlob) {
    logger.error(`No matching fixtures found for globbing pattern '${fixturesGlob}'`);
    process.exit(1);
  }

  const config = await readConfig(quiet);

  if (!quiet) {
    logger.info(`Measuring bundle size for ${fixtures.length} fixture(s)...`);
    logger.raw(fixtures.map(fixture => `  - ${fixture}`).join('\n'));
    logger.info(`Using ${config.bundler.name} as a bundler...`);
    if (singleBuild) {
      logger.info('Using single-build mode...');
    }
  }

  // Build fixtures using the appropriate mode
  const measurements = singleBuild
    ? await buildFixturesInSingleMode(config, fixtures, artifactsDir, debug, quiet)
    : await buildFixturesInLoopMode(config, fixtures, artifactsDir, debug, quiet);

  measurements.sort((a, b) => a.path.localeCompare(b.path, 'en'));

  await fs.promises.writeFile(path.resolve(artifactsDir, 'monosize.json'), JSON.stringify(measurements));

  displayResults(measurements, startTime, quiet);
}

// ---

const api: CommandModule<Record<string, unknown>, MeasureOptions> = {
  command: 'measure',
  describe: 'builds bundle size fixtures and generates JSON report',
  handler: measure,
  builder: {
    debug: {
      type: 'boolean',
      description: 'If true, will output additional artifacts for debugging',
    },
    'artifacts-location': {
      type: 'string',
      description:
        'Relative path to the package root where the artifact files will be stored (monosize.json & bundler output). If specified, "--report-files-glob" in "monosize collect-reports" & "monosize upload-reports" should be set accordingly.',
      default: 'dist/bundle-size',
    },
    fixtures: {
      type: 'string',
      description: 'Filename glob pattern to target whatever fixture files you want to measure.',
      default: '*.fixture.js',
    },
    'single-build': {
      type: 'boolean',
      description:
        'If true, all fixtures will be built in a single bundler run with multiple entry points. This can significantly reduce build time.',
      default: false,
    },
  },
};

export default api;
