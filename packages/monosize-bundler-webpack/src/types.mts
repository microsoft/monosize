import type { Configuration as WebpackConfiguration } from 'webpack';

export type WebpackBundlerOptions = {
  enhanceConfig?: (config: WebpackConfiguration) => WebpackConfiguration;
};
