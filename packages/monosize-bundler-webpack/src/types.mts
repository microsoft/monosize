import type { BundlerAdapterFactoryConfig } from 'monosize';
import type { Configuration as WebpackConfiguration } from 'webpack';

export type WebpackBundlerOptions = BundlerAdapterFactoryConfig<WebpackConfiguration>;
