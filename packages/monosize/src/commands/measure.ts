import * as chalk from 'chalk';
import * as Table from 'cli-table3';
import * as fs from 'fs';
import * as del from 'del';
import * as glob from 'glob';
import * as path from 'path';
import { CommandModule } from 'yargs';

import { CliOptions } from '../index';
import { buildFixture } from '../utils/buildFixture';
import { formatBytes, hrToSeconds } from '../utils/helpers';
import { prepareFixture } from '../utils/prepareFixture';
import { readConfig } from '../utils/readConfig';

async function measure(options: CliOptions) {
  const { quiet } = options;

  const startTime = process.hrtime();
  const artifactsDir = path.resolve(process.cwd(), 'dist', 'monosize');

  await del(artifactsDir);

  if (!quiet) {
    console.log(`${chalk.blue('[i]')} artifacts dir is cleared`);
  }

  const fixtures = glob.sync('monosize/*.fixture.js', {
    cwd: process.cwd(),
  });

  if (!quiet) {
    console.log(`${chalk.blue('[i]')} Measuring bundle size for ${fixtures.length} fixture(s)...`);
    console.log(fixtures.map(fixture => `  - ${fixture}`).join('\n'));
  }

  const config = await readConfig(quiet);

  const preparedFixtures = await Promise.all(fixtures.map(prepareFixture));
  const measurements = await Promise.all(
    preparedFixtures.map(preparedFixture => buildFixture(preparedFixture, config, quiet)),
  );

  await fs.promises.writeFile(
    path.resolve(process.cwd(), 'dist', 'monosize', 'monosize.json'),
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
