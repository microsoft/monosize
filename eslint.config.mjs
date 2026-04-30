import js from '@eslint/js';
import nxEslintPlugin from '@nx/eslint-plugin';
import eslintPluginImportX from 'eslint-plugin-import-x';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

export default [
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  js.configs.recommended,
  eslintPluginImportX.flatConfigs.typescript,
  {
    plugins: {
      '@nx': nxEslintPlugin,
      'import-x': eslintPluginImportX,
      unicorn: eslintPluginUnicorn,
    },
  },
  {
    settings: {
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.base.json',
        },
      },
    },
  },
  {
    rules: {
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: false,
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '.mts', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  ...nxEslintPlugin.configs['flat/typescript'].map(config => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
  })),
  {
    files: ['**/*.mts'],
    rules: {
      'unicorn/prefer-module': 'error',
      'unicorn/prefer-node-protocol': 'error',
    },
  },
  ...nxEslintPlugin.configs['flat/javascript'].map(config => ({
    ...config,
    files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
  })),
  {
    files: ['**/__fixtures__/**/*', '**/*.test.mts', '**/vite.config.mts'],
    rules: {
      'import-x/no-extraneous-dependencies': 'off',
    },
  },
];
