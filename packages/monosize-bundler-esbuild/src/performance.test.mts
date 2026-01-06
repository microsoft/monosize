/**
 * Performance comparison test for single-build vs standard loop mode.
 */
import fs from 'node:fs';
import tmp from 'tmp';
import { describe, expect, it, vitest } from 'vitest';

import { createEsbuildBundler } from './createEsbuildBundler.mjs';

function createFixtureContent(index: number): string {
  return `
    // Fixture ${index}
    const component${index} = {
      name: 'Component${index}',
      value: ${index},
      render: function() {
        return 'Component${index}: ' + this.value;
      }
    };
    
    const data${index} = Array(100).fill(0).map((_, i) => i + ${index * 100});
    
    function process${index}(items) {
      return items.filter(x => x % 2 === 0).map(x => x * 2);
    }
    
    export default {
      component: component${index},
      data: data${index},
      process: process${index}
    };
  `;
}

async function setupMultipleFixtures(
  count: number,
): Promise<{ dir: string; fixtures: Array<{ name: string; path: string }> }> {
  const packageDir = tmp.dirSync({
    prefix: 'perfTest',
    unsafeCleanup: true,
  });

  const spy = vitest.spyOn(process, 'cwd');
  spy.mockReturnValue(packageDir.name);

  const fixtureDir = tmp.dirSync({
    dir: packageDir.name,
    name: 'bundle-size',
    unsafeCleanup: true,
  });

  const fixtureResults = await Promise.all(
    Array.from({ length: count }, (_, i) => i).map(async i => {
      const name = `fixture${i}`;
      const fixture = tmp.fileSync({
        dir: fixtureDir.name,
        name: `${name}.fixture.js`,
      });
      await fs.promises.writeFile(fixture.name, createFixtureContent(i));
      return { name, path: fixture.name };
    }),
  );

  return { dir: fixtureDir.name, fixtures: fixtureResults };
}

const esbuildBundler = createEsbuildBundler();

interface SetupTestOptions {
  fixtureCount: number;
}

interface SetupTestResult {
  loopDuration: number;
  singleBuildDuration: number;
  speedup: number;
  timeSaved: number;
}

async function setupTest({ fixtureCount }: SetupTestOptions): Promise<SetupTestResult> {
  const { fixtures } = await setupMultipleFixtures(fixtureCount);

  // Test loop mode (original behavior)
  const loopStartTime = performance.now();
  for (const fixture of fixtures) {
    await esbuildBundler.buildFixture({
      debug: false,
      fixturePath: fixture.path,
      quiet: true,
    });
  }
  const loopEndTime = performance.now();
  const loopDuration = loopEndTime - loopStartTime;

  // Clean up outputs
  await Promise.all(
    fixtures.map(async f => {
      const outputPath = f.path.replace(/\.fixture\.js$/, '.output.js');
      try {
        await fs.promises.unlink(outputPath);
      } catch (e) {
        // ignore
      }
    }),
  );

  // Test single-build mode
  const singleBuildStartTime = performance.now();
  await esbuildBundler.buildFixtures!({
    fixtures: fixtures.map(f => ({ fixturePath: f.path, name: f.name })),
    debug: false,
    quiet: true,
  });
  const singleBuildEndTime = performance.now();
  const singleBuildDuration = singleBuildEndTime - singleBuildStartTime;

  const speedup = loopDuration / singleBuildDuration;
  const timeSaved = loopDuration - singleBuildDuration;

  const displayLabel = `${fixtureCount} fixtures`;
  console.log(`\n=== Performance Comparison Results (${displayLabel}) ===`);
  console.log(`Loop mode:         ${loopDuration.toFixed(2)}ms`);
  console.log(`Single-build mode: ${singleBuildDuration.toFixed(2)}ms`);
  console.log(`Speedup:           ${speedup.toFixed(2)}x`);
  console.log(`Time saved:        ${timeSaved.toFixed(2)}ms`);
  console.log('='.repeat(48 + displayLabel.length) + '\n');

  return { loopDuration, singleBuildDuration, speedup, timeSaved };
}

describe('Performance Comparison', () => {
  it('compares single-build vs loop mode for 10 fixtures', async () => {
    const { loopDuration, singleBuildDuration } = await setupTest({ fixtureCount: 10 });

    expect(singleBuildDuration).toBeLessThan(loopDuration);
  }, 120000); // 2 minute timeout

  it('compares single-build vs loop mode for 200 fixtures', async () => {
    const { loopDuration, singleBuildDuration } = await setupTest({ fixtureCount: 200 });

    expect(singleBuildDuration).toBeLessThan(loopDuration);
  }, 240000); // 4 minute timeout
});
