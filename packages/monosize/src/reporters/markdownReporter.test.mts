import prettier from 'prettier';
import { describe, expect, it, vitest } from 'vitest';

import { markdownReporter } from './markdownReporter.mjs';
import { sampleComparedReport } from '../__fixture__/sampleComparedReport.mjs';

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

describe('markdownReporter', () => {
  const options = {
    repository: 'https://github.com/microsoft/monosize',
    commitSHA: 'commit-hash',
    showUnchanged: true,
  };

  it('wont render anything if there is nothing to compare', () => {
    const log = vitest.spyOn(console, 'log').mockImplementation(noop);

    markdownReporter([], options);

    const output = prettier.format(log.mock.calls[0][0], { parser: 'markdown' });
    expect(output).toMatchInlineSnapshot(`
      "## 📊 Bundle size report

      ✅ No changes found
      "
    `);
  });

  it('renders a report to a file', () => {
    const log = vitest.spyOn(console, 'log').mockImplementation(noop);

    markdownReporter(sampleComparedReport, options);
    const output = prettier.format(log.mock.calls[0][0], { parser: 'markdown' });

    expect(output).toMatchSnapshot();
  });
});
