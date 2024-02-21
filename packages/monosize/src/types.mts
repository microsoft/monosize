import { Configuration as WebpackConfiguration } from 'webpack';

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

export type StorageAdapter = {
  getRemoteReport(branch: string): Promise<{ commitSHA: string; remoteReport: BundleSizeReport }>;
  uploadReportToRemote(branch: string, commitSHA: string, localReport: BundleSizeReport): Promise<void>;
};

export type MonoSizeConfig = {
  repository: string;
  storage: StorageAdapter;
  webpack?: (config: WebpackConfiguration) => WebpackConfiguration;
};
