module.exports = {
  testMatch: ['**/*.test.mts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.m?ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  moduleFileExtensions: ['js', 'ts', 'mts'],
};
