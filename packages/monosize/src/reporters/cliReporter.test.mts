import stripAnsi from 'strip-ansi';
import { describe, it, expect, vitest } from 'vitest';

import { cliReporter } from './cliReporter.mjs';
import { sampleComparedReport } from '../__fixture__/sampleComparedReport.mjs';

function noop() {
  /* does nothing */
}

// We are using "chalk" and "cli-table3" in this reporter, they are adding colors to the output via escape codes that
// makes snapshots look ugly.
//
// It could be disabled for "chalk" but "colors" that is used "cli-table3" is not our dependency.
expect.addSnapshotSerializer({
  test(val) {
    return typeof val === 'string';
  },
  print(val) {
    return stripAnsi(val as string);
  },
});

describe('cliReporter', () => {
  const options = {
    repository: 'https://github.com/microsoft/monosize',
    commitSHA: 'commit-hash',
    showUnchanged: false,
    deltaFormat: 'percent' as const,
  };

  it('wont render anything if there is nothing to compare', () => {
    const log = vitest.spyOn(console, 'log').mockImplementation(noop);

    cliReporter([], options);

    expect(log.mock.calls[0][0]).toMatchInlineSnapshot('[✔] No changes found');
  });

  it('renders a report to CLI output', () => {
    const log = vitest.spyOn(console, 'log').mockImplementation(noop);

    cliReporter(sampleComparedReport, options);

    expect(log.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌────────────────────┬────────┬───────────────────────┐
      │ Fixture            │ Before │ After (minified/GZIP) │
      ├────────────────────┼────────┼───────────────────────┤
      │ baz-package        │    0 B │            100%↑ 1 kB │
      │ An entry with diff │    0 B │           100%↑ 100 B │
      ├────────────────────┼────────┼───────────────────────┤
      │ foo-package        │    N/A │            100%↑ 1 kB │
      │ New entry (new)    │    N/A │           100%↑ 100 B │
      └────────────────────┴────────┴───────────────────────┘
    `);
  });

  it('renders a report to CLI output with specified "deltaFormat"', () => {
    const log = vitest.spyOn(console, 'log').mockImplementation(noop);

    cliReporter(sampleComparedReport, { ...options, deltaFormat: 'delta' });

    expect(log.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌────────────────────┬────────┬───────────────────────┐
      │ Fixture            │ Before │ After (minified/GZIP) │
      ├────────────────────┼────────┼───────────────────────┤
      │ baz-package        │    0 B │            1 kB↑ 1 kB │
      │ An entry with diff │    0 B │          100 B↑ 100 B │
      ├────────────────────┼────────┼───────────────────────┤
      │ foo-package        │    N/A │             1 B↑ 1 kB │
      │ New entry (new)    │    N/A │            1 B↑ 100 B │
      └────────────────────┴────────┴───────────────────────┘
    `);
  });
});
