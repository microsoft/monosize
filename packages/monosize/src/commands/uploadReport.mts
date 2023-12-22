import { isCI } from 'ci-info';
import pc from 'picocolors';
import type { CommandModule } from 'yargs';

import { collectLocalReport } from '../utils/collectLocalReport.mjs';
import { hrToSeconds } from '../utils/helpers.mjs';
import { readConfig } from '../utils/readConfig.mjs';
import type { CliOptions } from '../index.mjs';

type UploadOptions = CliOptions & { branch: string; 'report-files-glob'?: string; 'commit-sha': string };

async function uploadReport(options: UploadOptions) {
  if (!isCI) {
    console.log(`${pc.red('[e]')} This is command can be executed only in CI`);
    process.exit(1);
  }

  const { branch, 'commit-sha': commitSHA, quiet } = options;
  const startTime = process.hrtime();

  const config = await readConfig(quiet);

  const localReportStartTime = process.hrtime();
  const localReport = await collectLocalReport({
    ...(options['report-files-glob'] && { reportFilesGlob: options['report-files-glob'] }),
  });

  if (!quiet) {
    console.log(
      [pc.blue('[i]'), `Local report prepared in ${hrToSeconds(process.hrtime(localReportStartTime))}`].join(' '),
    );
  }

  const uploadStartTime = process.hrtime();

  try {
    await config.storage.uploadReportToRemote(branch, commitSHA, localReport);
  } catch (e) {
    console.log([pc.red('[e]'), 'Upload of the report to a remote host failed...'].join(' '));
    console.log(e);
    process.exit(1);
  }

  if (!quiet) {
    console.log([pc.blue('[i]'), `Report uploaded in ${hrToSeconds(process.hrtime(uploadStartTime))}`].join(' '));
    console.log(`Completed in ${hrToSeconds(process.hrtime(startTime))}`);
  }
}

// ---

const api: CommandModule<Record<string, unknown>, UploadOptions> = {
  command: 'upload-report',
  describe: 'uploads local results to Azure Table Storage',
  builder: {
    branch: {
      type: 'string',
      description: 'A branch to associate a report',
      required: true,
    },
    'report-files-glob': {
      type: 'string',
      description: 'A glob pattern to search for report files in JSON format',
      required: false,
    },
    'commit-sha': {
      type: 'string',
      description: 'Defines a commit sha for a report',
      required: true,
    },
  },
  handler: uploadReport,
};

export default api;
