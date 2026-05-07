import createRspackBundler from 'monosize-bundler-rspack';

/**
 * Mock storage adapter — returns a "previous" report whose totals and
 * per-asset breakdown are smaller than current so `compare-reports` shows
 * a positive (regression) diff for both `js` and `css`, exercising the
 * markdown breakdown section. `uploadReportToRemote` is a no-op; the
 * smoke doesn't run that command.
 *
 * @type {import('monosize').StorageAdapter}
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
          // Smaller-than-current sizes so the diff is positive (regression).
          minifiedSize: 100,
          gzippedSize: 50,
          assets: {
            js: { minifiedSize: 80, gzippedSize: 40 },
            css: { minifiedSize: 20, gzippedSize: 10 },
          },
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
  // Default is `['js']`; opt in to `'css'` so the smoke covers a multi-asset report.
  assetTypes: ['js', 'css'],
  bundler: createRspackBundler(rsbuildConfig => {
    // rsbuild inlines CSS into JS by default. Flip to emit a sidecar so
    // the CLI's directory walk picks it up as a separate asset.
    for (const env of Object.values(rsbuildConfig.environments ?? {})) {
      env.output ??= {};
      env.output.injectStyles = false;
      env.output.distPath = { ...(env.output.distPath ?? {}), css: './' };
      env.output.filename = { ...(env.output.filename ?? {}), css: '[name]/index.css' };
    }
    return rsbuildConfig;
  }),
  storage: mockStorage,
};

export default config;
