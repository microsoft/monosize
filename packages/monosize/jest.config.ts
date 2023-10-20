/* eslint-disable */
export default {
  displayName: 'monosize',
  preset: '../../jest.preset.js',
  globals: {},
  resolver: '<rootDir>/../../jest.resolver.js',
  coverageDirectory: '../../coverage/packages/monosize',
  setupFilesAfterEnv: ['./jest.setup.ts'],
  transform: {
    '^.+\\.m?ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        useESM: true,
        diagnostics: {
          ignoreCodes: [1343],
        },
        astTransformers: {
          before: [
            {
              path: 'node_modules/ts-jest-mock-import-meta',
              options: {
                metaObjectReplacement: {
                  url: require('url').pathToFileURL(__dirname).href,
                },
              },
            },
          ],
        },
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/', '/monosize.config.js/'],
};
