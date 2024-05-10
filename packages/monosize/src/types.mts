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

export type MonoSizeConfig = {
  repository: string;
  storage: StorageAdapter;
  bundler: BundlerAdapter;
};
