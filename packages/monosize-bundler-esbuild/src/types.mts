import type { BuildOptions } from 'esbuild';

export type EsbuildBundlerOptions = {
  enhanceConfig?: (config: BuildOptions) => BuildOptions;
};
