/* eslint-disable */
export default {
  displayName: 'monosize-storage-azure',
  preset: '../../jest.preset.js',
  globals: {},
  resolver: '<rootDir>/../../jest.resolver.js',
  transform: {
    '^.+\\.m?ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        useESM: true,
      },
    ],
  },
  coverageDirectory: '../../coverage/packages/monosize-storage-azure',
};
