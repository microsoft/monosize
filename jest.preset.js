module.exports = {
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
