import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import js from '@eslint/js';
import nxEslintPlugin from '@nx/eslint-plugin';
import eslintPluginImportX from 'eslint-plugin-import-x';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
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
  ...compat
    .config({
      extends: ['plugin:@nx/typescript'],
    })
    .map(config => ({
      ...config,
      files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
      rules: {
        ...config.rules,
      },
    })),
  {
    files: ['**/*.mts'],
    rules: {
      'unicorn/prefer-module': 'error',
      'unicorn/prefer-node-protocol': 'error',
    },
  },
  ...compat
    .config({
      extends: ['plugin:@nx/javascript'],
    })
    .map(config => ({
      ...config,
      files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
      rules: {
        ...config.rules,
      },
    })),
  {
    files: ['**/__fixtures__/**/*', '**/*.test.mts', '**/vite.config.mts'],
    rules: {
      'import-x/no-extraneous-dependencies': 'off',
    },
  },
];
