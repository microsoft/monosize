import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import { describe, it, expect } from 'vitest';
import type { BundleSizeReport } from 'monosize';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const monosizeBin = path.join(repoRoot, 'packages', 'monosize', 'bin', 'monosize.mjs');

async function runMonosize(args: string[]): Promise<{ stdout: string; stderr: string }> {
  // compare-reports exits with code 1 when threshold is exceeded — that's
  // expected for the smoke (we deliberately set baseline sizes lower than
  // current). Capture stdout/stderr regardless of exit code.
  return execFileAsync(process.execPath, [monosizeBin, ...args], { cwd: here }).catch(err => {
    if (err && typeof err === 'object' && 'stdout' in err) {
      return { stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? '') };
    }
    throw err;
  });
}

describe('rspack smoke', () => {
  it('measure produces a report with both js and css assets', async () => {
    await runMonosize(['measure', '--quiet']);

    const reportPath = path.join(here, 'dist', 'bundle-size', 'monosize.json');
    expect(fs.existsSync(reportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as BundleSizeReport;
    const entry = report.find(e => e.name === 'smoke');
    // Snapshot encodes the shape (entry present, both js + css measured) and
    // the totals-equal-asset-sum invariant. Refresh with `vitest -u` if a
    // bundler bump shifts byte counts.
    expect(entry).toMatchInlineSnapshot(`
      {
        "assets": {
          "css": {
            "gzippedSize": 135,
            "minifiedSize": 126,
          },
          "js": {
            "gzippedSize": 179,
            "minifiedSize": 236,
          },
        },
        "gzippedSize": 314,
        "minifiedSize": 362,
        "name": "smoke",
        "path": "bundle-size/smoke.fixture.js",
      }
    `);
  });

  it('compare-reports renders a per-asset breakdown', async () => {
    // Depends on the report from the previous test; vitest runs `it` blocks
    // in declaration order within a single file by default. Override the
    // report-files glob since the smoke lives under e2e/, not packages/.
    const { stdout } = await runMonosize([
      'compare-reports',
      '--output',
      'markdown',
      '--quiet',
      // collectLocalReport globs from the git root by default, not the smoke's
      // cwd, so point the glob at the smoke's own dist directory.
      '--report-files-glob',
      'e2e/smoke-rspack/dist/bundle-size/monosize.json',
    ]);
    const formatted = await prettier.format(stdout, { parser: 'markdown' });
    expect(formatted).toMatchInlineSnapshot(`
      "## 📊 Bundle size report

      | Package & Exports                                                                                                 | Baseline (minified/GZIP) |                   PR |                                                                                                                                                                                                   Change |
      | :---------------------------------------------------------------------------------------------------------------- | -----------------------: | -------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
      | <samp>smoke-rspack</samp> <br /> <abbr title='bundle-size/smoke.fixture.js'>smoke</abbr> <br /> ⚠️ over threshold |      \`100 B\`<br />\`50 B\` | \`362 B\`<br />\`314 B\` | \`262 B\` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /><br />\`264 B\` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /> |

      ### Breakdown

      <details><summary><samp>smoke-rspack</samp> · smoke</summary>

      - \`css\`: \`106 B\` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /> minified, \`125 B\` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /> gzipped
      - \`js\`: \`156 B\` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /> minified, \`139 B\` <img aria-hidden="true" src="https://microsoft.github.io/monosize/images/increase.png" /> gzipped
      </details>

      <sub>🤖 This report was generated against <a href='https://example.com/monosize-smoke-rspack/commit/fake-baseline-sha'>fake-baseline-sha</a></sub>
      "
    `);
  });
});
