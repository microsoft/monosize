import path from 'node:path';
import { fileURLToPath } from 'node:url';
import createRspackBundler from 'monosize-bundler-rspack';

const here = path.dirname(fileURLToPath(import.meta.url));
const originalFixturesDir = path.join(here, 'bundle-size');

/**
 * Mock storage adapter — returns a "previous" report intentionally
 * missing the `assets` field so `compare-reports` exercises the
 * legacy-entry path (legend note in markdown). `uploadReportToRemote`
 * is a no-op; the smoke doesn't run that command.
 */
const mockStorage = {
  async getRemoteReport() {
    return {
      commitSHA: 'fake-baseline-sha',
      remoteReport: [
        {
          // collectLocalReport prefers `project.json#name` over package.json
          // when both exist, so use the project name to match the local entry.
          packageName: 'smoke-rspack',
          name: 'smoke',
          path: 'bundle-size/smoke.fixture.js',
          // Smaller-than-current sizes so the diff is positive (regression),
          // making the legend note + breakdown both observable.
          minifiedSize: 100,
          gzippedSize: 50,
          // Deliberately no `assets` — old-format entry.
        },
      ],
    };
  },
  async uploadReportToRemote() {
    /* no-op */
  },
};

/** @type {import('monosize').MonoSizeConfig} */
const config = {
  repository: 'https://example.com/monosize-smoke-rspack',
  bundler: createRspackBundler(rsbuildConfig => {
    // Resolve `import 'smoke-rspack-styles'` from inside the prepared fixture
    // (which lives in dist/bundle-size/) back to the source bundle-size/ dir.
    rsbuildConfig.resolve ??= {};
    rsbuildConfig.resolve.alias = {
      ...(rsbuildConfig.resolve.alias ?? {}),
      'smoke-rspack-styles': path.join(originalFixturesDir, 'styles.css'),
    };

    // The rspack adapter sets `emitAssets: false` and `injectStyles: true` by
    // default (CSS is inlined into JS). Flip both per environment so CSS is
    // extracted as a sidecar — this is the explicit opt-in users need to
    // measure CSS. Without this, only JS shows up in the report.
    //
    // Also flatten the asset-emission paths: rsbuild's default routes CSS
    // into `static/css/<name>.<hash>.css` and emits an HTML file. The CLI
    // walks outputDir non-recursively, so CSS must land at the root and the
    // HTML emit should be disabled.
    for (const env of Object.values(rsbuildConfig.environments ?? {})) {
      env.output ??= {};
      env.output.emitAssets = true;
      env.output.injectStyles = false;
      // CSS uses the same `[name]/...` template as JS so each fixture's
      // outputs are co-located under sharedRoot/<entryName>/.
      env.output.distPath = {
        ...(env.output.distPath ?? {}),
        css: './',
      };
      env.output.filename = {
        ...(env.output.filename ?? {}),
        css: '[name]/index.css',
      };
    }
    return rsbuildConfig;
  }),
  storage: mockStorage,
};

export default config;
