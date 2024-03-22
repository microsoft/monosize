import type { Configuration as WebpackConfiguration } from 'webpack';

export type WebpackBundlerOptions = (config: WebpackConfiguration) => WebpackConfiguration;
