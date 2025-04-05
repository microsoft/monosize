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
};

async function measure(options: MeasureOptions) {
  const { debug = false, quiet, 'artifacts-location': artifactsLocation, fixtures: fixturesGlob } = options;

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
  const measurements: BuildResult[] = [];

  if (!quiet) {
    logger.info(`Measuring bundle size for ${fixtures.length} fixture(s)...`);
    logger.raw(fixtures.map(fixture => `  - ${fixture}`).join('\n'));
    logger.info(`Using ${config.bundler.name} as a bundler...`);
  }

  for (const fixturePath of fixtures) {
    const fixtureStartTime = process.hrtime();

    const { artifactPath, name } = await prepareFixture(artifactsDir, fixturePath);
    const { outputPath } = await config.bundler.buildFixture({
      debug,
      fixturePath: artifactPath,
      quiet,
    });

    const minifiedSize = (await fs.promises.stat(outputPath)).size;
    const gzippedSize = await gzipSizeFromFile(outputPath);

    measurements.push({
      name,
      path: path.relative(process.cwd(), fixturePath).replaceAll(path.sep, '/'),
      minifiedSize,
      gzippedSize,
    });

    if (!quiet) {
      logger.info(`Fixture "${path.basename(fixturePath)}" built`, fixtureStartTime);
    }
  }

  measurements.sort((a, b) => a.path.localeCompare(b.path, 'en'));

  await fs.promises.writeFile(path.resolve(artifactsDir, 'monosize.json'), JSON.stringify(measurements));

  if (!quiet) {
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
  },
};

export default api;
