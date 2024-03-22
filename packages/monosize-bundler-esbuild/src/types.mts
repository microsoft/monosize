import type { BuildOptions } from 'esbuild';

export type EsbuildBundlerOptions = (config: BuildOptions) => BuildOptions;
