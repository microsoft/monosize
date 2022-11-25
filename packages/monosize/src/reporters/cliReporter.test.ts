// @ts-expect-error There is something wrong with typings for this module
import * as stripAnsi from 'strip-ansi';

import { cliReporter } from './cliReporter';
import { sampleComparedReport } from '../__fixture__/sampleComparedReport';

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
  it('renders a report to CLI output', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(noop);
    await cliReporter(sampleComparedReport);

    expect(log.mock.calls[0][0]).toMatchInlineSnapshot(`
      ┌────────────────────┬────────┬───────────────────────┐
      │ Fixture            │ Before │ After (minified/GZIP) │
      ├────────────────────┼────────┼───────────────────────┤
      │ baz-package        │      0 │            100%↑ 1000 │
      │ An entry with diff │      0 │             100%↑ 100 │
      ├────────────────────┼────────┼───────────────────────┤
      │ foo-package        │    N/A │            100%↑ 1000 │
      │ New entry (new)    │    N/A │             100%↑ 100 │
      └────────────────────┴────────┴───────────────────────┘
    `);
  });
});
