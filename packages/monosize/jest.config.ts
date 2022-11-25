/* eslint-disable */
export default {
  displayName: 'monosize',
  preset: '../../jest.preset.js',
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.spec.json',
    },
  },
  resolver: '<rootDir>/../../jest.resolver.js',
  coverageDirectory: '../../coverage/packages/monosize',
  setupFilesAfterEnv: ['./jest.setup.ts'],
};
