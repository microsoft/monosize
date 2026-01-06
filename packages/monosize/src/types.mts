export type BuildResult = {
  name: string;
  path: string;
  minifiedSize: number;
  gzippedSize: number;
};

export type BundleSizeReportEntry = Pick<BuildResult, 'name' | 'path' | 'minifiedSize' | 'gzippedSize'> & {
  packageName: string;
};
export type BundleSizeReport = BundleSizeReportEntry[];

export type ThresholdValue = {
  size: number;
  type: 'size' | 'percent';
};

//
// Storage

export type StorageAdapter = {
  getRemoteReport(branch: string): Promise<{ commitSHA: string; remoteReport: BundleSizeReport }>;
  uploadReportToRemote(branch: string, commitSHA: string, localReport: BundleSizeReport): Promise<void>;
};

//
// Bundlers

export type BundlerAdapter = {
  buildFixture: (options: { fixturePath: string; debug: boolean; quiet: boolean }) => Promise<{
    outputPath: string;
    debugOutputPath?: string;
  }>;

  /**
   * Optional method to build multiple fixtures in a single build operation.
   * When implemented, this can significantly reduce build time for bundlers that support multiple entry points.
   * Currently only supported by the Webpack bundler.
   */
  buildFixtures?: (options: {
    fixtures: Array<{ fixturePath: string; name: string }>;
    debug: boolean;
    quiet: boolean;
  }) => Promise<
    Array<{
      name: string;
      outputPath: string;
      debugOutputPath?: string;
    }>
  >;

  /** A friendly name of the bundler used for logging. */
  name: string;
};

/**
 * @kind shared
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BundlerAdapterFactoryConfig<T extends Record<string, any>> = (config: T) => T;

/**
 * @kind shared
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BundleAdapterFactory<T extends Record<string, any>> = (
  options: BundlerAdapterFactoryConfig<T>,
) => BundlerAdapter;

type ReportResolvers = {
  /**
   * Override package name resolution used within compare-reports and upload-report.
   *
   * By default we try to read package name from "package.json" or "project.json" files.
   * You can override this behavior by providing your own implementation.
   */
  packageName?: (packageRoot: string) => Promise<string>;
  /**
   *
   * Override package root resolution used within compare-reports and upload-report.
   *
   * By default we try to resolve package root by traversing up the directory tree until we find "package.json" or "project.json" files.
   * You can override this behavior by providing your own implementation.
   *
   * @param reportFilePath - absolute path to the report file (monosize.json)
   */
  packageRoot?: (reportFilePath: string) => Promise<string>;
};

export type MonoSizeConfig = {
  repository: string;
  storage: StorageAdapter;
  bundler: BundlerAdapter;

  /**
   * Report Commands Configuration Overrides
   * Use this if you need to customize package name or package root resolution logic within bundle reports.
   */
  reportResolvers?: ReportResolvers;

  /**
   * A threshold limit for checking if the bundle size is within the limit.
   * It should be a string with a number and unit. Format: `0.5 kB`, `1kB, `10%`.
   */
  threshold?: string;
};
