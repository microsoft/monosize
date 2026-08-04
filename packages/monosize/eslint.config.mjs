import baseConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  ...baseConfig,
  {
    rules: {
      'no-console': 'error',
    },
  },
  {
    ignores: ['**/vitest.config.*.timestamp*'],
  },
];
