import prettier from 'prettier';
import { describe, expect, it, vitest } from 'vitest';

import { markdownReporter } from './markdownReporter.mjs';
import { sampleComparedReport } from '../__fixture__/sampleComparedReport.mjs';

describe('markdownReporter', () => {
  it('renders a report to a file', async () => {
    const log = vitest.spyOn(console, 'log').mockImplementation(() => {
      /* no op */
    });

    const repository = 'https://github.com/microsoft/monosize';
    const commitSHA = 'commit-hash';

    await markdownReporter(sampleComparedReport, commitSHA, repository, true);
    const output = prettier.format(log.mock.calls[0][0], { parser: 'markdown' });

    expect(output).toMatchSnapshot();
  });
});
