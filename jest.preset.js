const nxPreset = require('@nrwl/jest/preset').default;

module.exports = {
  // ...nxPreset,
  extensionsToTreatAsEsm: ['.ts', '.tsx', '.mts'],
  testMatch: ['**/*.test.mts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.m?[tj]s$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleFileExtensions: ['js', 'ts', 'mts'],
};
