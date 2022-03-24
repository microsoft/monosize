import { markdownReporter } from './markdownReporter';
import { sampleComparedReport } from '../__fixture__/sampleComparedReport';

describe('markdownReporter', () => {
  it('renders a report to a file', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const writeFile = jest.spyOn(require('fs').promises, 'writeFile').mockImplementation(() => {
      return new Promise(resolve => resolve(undefined));
    });

    await markdownReporter(sampleComparedReport, 'commit-hash', true);
    expect(writeFile.mock.calls[0][1]).toMatchSnapshot();
  });
});
