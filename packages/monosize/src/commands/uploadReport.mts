import { isCI } from 'ci-info';
import type { CommandModule } from 'yargs';

import { collectLocalReport } from '../utils/collectLocalReport.mjs';
import { readConfig } from '../utils/readConfig.mjs';
import type { CliOptions } from '../index.mjs';
import { log, timestamp } from '../output.mjs';

type UploadOptions = CliOptions & { branch: string; 'report-files-glob'?: string; 'commit-sha': string };

async function uploadReport(options: UploadOptions) {
  if (!isCI) {
    log.error('This is command can be executed only in CI');
    process.exit(1);
  }

  const { branch, 'commit-sha': commitSHA, quiet } = options;
  const startTime = timestamp();

  const config = await readConfig(quiet);

  const localReportStartTime = timestamp();
  const localReport = await collectLocalReport({
    ...config,
    reportFilesGlob: options['report-files-glob'],
  });

  if (!quiet) {
    log.info(`Local report prepared`, localReportStartTime);
  }

  const uploadStartTime = timestamp();

  try {
    await config.storage.uploadReportToRemote(branch, commitSHA, localReport);
  } catch (e) {
    log.error('Upload of the report to a remote host failed...');
    log.error(e);
    process.exit(1);
  }

  if (!quiet) {
    log.info('Report uploaded', uploadStartTime);
    log.finish(`Completed`, startTime);
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
