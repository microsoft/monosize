import { describe, expect, it, vitest } from 'vitest';

import { markdownReporter } from './markdownReporter.mjs';
import { sampleComparedReport } from '../__fixture__/sampleComparedReport.mjs';

describe('markdownReporter', () => {
  it('renders a report to a file', async () => {
    // eslint-disable-next-line unicorn/prefer-module, @typescript-eslint/no-var-requires
    const writeFile = vitest.spyOn(require('node:fs').promises, 'writeFile');

    await markdownReporter(sampleComparedReport, 'commit-hash', 'https://github.com/microsoft/monosize', true);
    expect(writeFile.mock.calls[0][1]).toMatchSnapshot();
  });
});
