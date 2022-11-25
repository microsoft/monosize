import Table from 'cli-table3';
import fs from 'fs';
import { deleteAsync } from 'del';
import glob from 'glob';
import path from 'path';
import pc from 'picocolors';
import type { CommandModule } from 'yargs';

import { buildFixture } from '../utils/buildFixture.mjs';
import { formatBytes, hrToSeconds } from '../utils/helpers.mjs';
import { prepareFixture } from '../utils/prepareFixture.mjs';
import { readConfig } from '../utils/readConfig.mjs';
import type { CliOptions } from '../index.mjs';

async function measure(options: CliOptions) {
  const { quiet } = options;

  const startTime = process.hrtime();
  const artifactsDir = path.resolve(process.cwd(), 'dist', 'monosize');

  await deleteAsync(artifactsDir);

  if (!quiet) {
    console.log(`${pc.blue('[i]')} artifacts dir is cleared`);
  }

  const fixtures = glob.sync('bundle-size/*.fixture.js', {
    cwd: process.cwd(),
  });

  if (!quiet) {
    console.log(`${pc.blue('[i]')} Measuring bundle size for ${fixtures.length} fixture(s)...`);
    console.log(fixtures.map(fixture => `  - ${fixture}`).join('\n'));
  }

  const config = await readConfig(quiet);

  const preparedFixtures = await Promise.all(fixtures.map(prepareFixture));
  const measurements = await Promise.all(
    preparedFixtures.map(preparedFixture => buildFixture(preparedFixture, config, quiet)),
  );

  await fs.promises.writeFile(
    path.resolve(process.cwd(), 'dist', 'bundle-size', 'monosize.json'),
    JSON.stringify(measurements),
  );

  if (!quiet) {
    const table = new Table({
      head: ['Fixture', 'Minified size', 'GZIP size'],
    });
    const sortedMeasurements = [...measurements].sort((a, b) => a.path.localeCompare(b.path));

    sortedMeasurements.forEach(r => {
      table.push([r.name, formatBytes(r.minifiedSize), formatBytes(r.gzippedSize)]);
    });

    console.log(table.toString());
    console.log(`Completed in ${hrToSeconds(process.hrtime(startTime))}`);
  }
}

// ---

const api: CommandModule<Record<string, unknown>, CliOptions> = {
  command: 'measure',
  describe: 'builds bundle size fixtures and generates JSON report',
  handler: measure,
};

export default api;
