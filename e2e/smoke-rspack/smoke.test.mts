import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const monosizeBin = path.join(repoRoot, 'packages', 'monosize', 'bin', 'monosize.mjs');
const distEntry = path.join(repoRoot, 'packages', 'monosize', 'dist', 'index.mjs');

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
  beforeAll(() => {
    if (!fs.existsSync(distEntry)) {
      throw new Error(
        `monosize dist not found at ${distEntry}. Build it first: yarn nx run monosize:build`,
      );
    }
  });

  it('measure produces a report with both js and css assets', async () => {
    await runMonosize(['measure', '--quiet']);

    const reportPath = path.join(here, 'dist', 'bundle-size', 'monosize.json');
    expect(fs.existsSync(reportPath)).toBe(true);

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Array<{
      name: string;
      minifiedSize: number;
      gzippedSize: number;
      assets?: Record<string, { minifiedSize: number; gzippedSize: number }>;
    }>;
    const entry = report.find(e => e.name === 'smoke');
    expect(entry, 'smoke entry should be present in report').toBeDefined();
    expect(entry!.assets?.js?.minifiedSize, 'js asset measured').toBeGreaterThan(0);
    expect(entry!.assets?.css?.minifiedSize, 'css asset measured').toBeGreaterThan(0);

    const totals = Object.values(entry!.assets ?? {}).reduce(
      (acc, a) => ({
        minifiedSize: acc.minifiedSize + a.minifiedSize,
        gzippedSize: acc.gzippedSize + a.gzippedSize,
      }),
      { minifiedSize: 0, gzippedSize: 0 },
    );
    expect(entry!.minifiedSize).toBe(totals.minifiedSize);
    expect(entry!.gzippedSize).toBe(totals.gzippedSize);
  });

  it('compare-reports renders breakdown legend for old-format remote entries', async () => {
    // Depends on the report from the previous test; vitest runs `it` blocks
    // in declaration order within a single file by default. Override the
    // report-files glob since the smoke lives under e2e/, not packages/.
    const { stdout } = await runMonosize([
      'compare-reports',
      '--output',
      'markdown',
      // collectLocalReport globs from the git root by default, not the smoke's
      // cwd, so point the glob at the smoke's own dist directory.
      '--report-files-glob',
      'e2e/smoke-rspack/dist/bundle-size/monosize.json',
    ]);
    expect(stdout).toContain('### Breakdown');
    expect(stdout).toMatch(/Breakdown unavailable for some fixtures/);
  });
});
