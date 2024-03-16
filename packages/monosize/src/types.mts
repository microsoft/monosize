export type PreparedFixture = {
  absolutePath: string;
  relativePath: string;
  name: string;
};

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

export type MonoSizeConfig = {
  repository: string;
  storage: StorageAdapter;
  bundler: BundlerAdapter;
};
